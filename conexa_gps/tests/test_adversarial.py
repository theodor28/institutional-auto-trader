"""Adversarial checks for privacy, access control and route safety.
Run: python -m unittest discover -s tests -v
"""
import random
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from http.server import ThreadingHTTPServer
import requests
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import app

class AdversarialTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        cls.original=(app.DB_PATH,app.DATABASE_URL,app.IS_PROD)
        app.DATABASE_URL='';app.IS_PROD=False
        app.DB_PATH=str(Path(cls.tmp.name)/'adversarial.db')
        app.init_db()
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),app.Handler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.base='http://127.0.0.1:'+str(cls.server.server_address[1])

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join(timeout=5)
        app.DB_PATH,app.DATABASE_URL,app.IS_PROD=cls.original
        cls.tmp.cleanup()

    def user(self,handle):
        session=requests.Session()
        r=session.post(self.base+'/api/register',json={
            'handle':handle,'password':'test_very_long_password_2026',
            'adult':True,'terms':True
        },headers={'Origin':self.base},timeout=10)
        self.assertEqual(r.status_code,200,r.text)
        return session,r.json()['csrf']

    def post(self,sess,path,body,csrf=''):
        headers={'Origin':self.base}
        if csrf:headers['X-CSRF-Token']=csrf
        return sess.post(self.base+path,json=body,headers=headers,timeout=10)

    def sample(self):
        return {
          'kind':'package','title':'Encomenda pequena',
          'start_name':'Riacho Grande','end_name':'Vinhedo',
          'start_lat':-23.8,'start_lon':-46.56,
          'end_lat':-23.03,'end_lon':-46.97,
          'departure':int(time.time())+3600,
          'capacity_kg':10,'max_detour_km':0,
          'length_cm':40,'width_cm':30,'height_cm':20,
          'price':50,'details':'Pacote lacrado','vehicle':'Saveiro'}

    def test_private_contact_details_blocked(self):
        sess,csrf=self.user('privacybeta')
        for key,value in [('title','CPF 123.456.789-09'),
                          ('details','Escreva para pessoa@email.com'),
                          ('details','WhatsApp 11999998888')]:
            data=self.sample();data[key]=value
            r=self.post(sess,'/api/posts',data,csrf)
            self.assertEqual(r.status_code,400,(key,r.text))

    def test_access_authorization_and_csrf(self):
        owner,csrf=self.user('ownerbeta')
        other,othercsrf=self.user('otherbeta')
        created=self.post(owner,'/api/posts',self.sample(),csrf)
        self.assertEqual(created.status_code,201,created.text)
        pid=created.json()['id']
        self.assertEqual(self.post(other,'/api/close',{'post_id':pid},othercsrf).status_code,404)
        self.assertEqual(self.post(owner,'/api/close',{'post_id':pid}).status_code,403)

    def test_duplicate_offer_race(self):
        owner,owner_csrf=self.user('sendbeta')
        other,csrf=self.user('driverbeta')
        created=self.post(owner,'/api/posts',self.sample(),owner_csrf)
        self.assertEqual(created.status_code,201,created.text)
        pid=created.json()['id']
        outcome=[]
        def send():
            r=self.post(other,'/api/offers',{'post_id':pid,'message':'Tenho interesse na entrega, confirmamos?'},csrf)
            outcome.append(r.status_code)
        threads=[threading.Thread(target=send) for _ in range(2)]
        for t in threads:t.start()
        for t in threads:t.join(timeout=10)
        self.assertEqual(sorted(outcome),[201,409],outcome)

    def test_reject_unsupported_transfer_encoding(self):
        import http.client
        port=self.server.server_address[1]
        conn=http.client.HTTPConnection('127.0.0.1',port,timeout=8)
        conn.putrequest('POST','/api/login')
        conn.putheader('Content-Type','application/json')
        conn.putheader('Transfer-Encoding','chunked')
        conn.endheaders()
        result=conn.getresponse()
        self.assertEqual(result.status,400)
        result.read()
        conn.close()

    def test_geometry_never_invents_road_time(self):
        ride=self.sample()|{'kind':'ride','capacity_kg':200,
                            'length_cm':180,'width_cm':140,'height_cm':90,'max_detour_km':100}
        random.seed(20261119)
        for _ in range(1000):
            pack=self.sample()
            pack['start_lat']=random.uniform(-24,-23)
            pack['start_lon']=random.uniform(-48,-46)
            pack['end_lat']=random.uniform(-24,-23)
            pack['end_lon']=random.uniform(-48,-46)
            r=app.matching(ride,pack)
            if r is not None:
                self.assertFalse(r['road_route_confirmed'])
                self.assertIsNone(r['estimated_minutes'])

if __name__=='__main__':unittest.main(verbosity=2)
