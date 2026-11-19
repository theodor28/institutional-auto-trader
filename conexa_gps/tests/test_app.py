import json
import os
import tempfile
import threading
import time
import unittest
from datetime import datetime
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import requests
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app


class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        app.DB_PATH = str(Path(cls.tmp.name)/'test.db')
        app.DATABASE_URL = ''
        app.IS_PROD = False
        app.init_db()
        cls.server = ThreadingHTTPServer(('127.0.0.1',0), app.Handler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.server_thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_address[1]}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.server_thread.join(timeout=3);cls.tmp.cleanup()

    def setUp(self):
        self.a = requests.Session();self.b=requests.Session()
        self.unique=str(time.time_ns())[-10:]

    def post(self, client, endpoint, payload, csrf=None, origin=None):
        headers={'Origin':origin or self.base}
        if csrf: headers['X-CSRF-Token']=csrf
        return client.post(self.base+endpoint,json=payload,headers=headers,timeout=10)

    def register(self, sess, label):
        data={'handle':label+self.unique,'password':'s3nhA_segura_2026!','adult':True,'terms':True}
        res=self.post(sess,'/api/register',data)
        self.assertEqual(res.status_code,200,res.text)
        return res.json()

    def example(self,kind='ride',start=(-23.80,-46.56),end=(-23.03,-46.97),capacity=100,detour=20):
        return {'kind':kind,'title':('Viagem real' if kind=='ride' else 'Encomenda leve')+' para viagem',
            'start_name':'Riacho Grande','end_name':'Vinhedo',
            'start_lat':start[0],'start_lon':start[1],'end_lat':end[0],'end_lon':end[1],
            'departure':int(time.time())+3600,'capacity_kg':capacity,'max_detour_km':detour,
            'length_cm':(200 if kind=='ride' else 60),'width_cm':(150 if kind=='ride' else 40),'height_cm':(110 if kind=='ride' else 30),'price':59.90,'vehicle':'Saveiro','details':'Caixa leve e segura'}

    def test_health_and_static(self):
        r=self.a.get(self.base+'/api/health')
        self.assertEqual(r.status_code,200)
        self.assertFalse(r.json()['durable_public_storage'])
        self.assertFalse(r.json()['real_road_routing'])
        h=self.a.get(self.base+'/')
        self.assertIn('CONEXA GPS',h.text)
        self.assertIn('geolocation=(self)',h.headers['Permissions-Policy'])
        self.assertEqual(self.a.get(self.base+'/static/app.js').status_code,200)
        self.assertEqual(self.a.get(self.base+'/bad/path').status_code,404)

    def test_signup_auth_cookie_csrf(self):
        u=self.register(self.a,'usu')
        self.assertTrue(u['csrf'])
        self.assertNotIn('password',str(u))
        cookie=self.a.cookies.get('conexa_session')
        self.assertTrue(cookie)
        state=self.a.get(self.base+'/api/me').json()
        self.assertEqual(state['user']['handle'],u['user']['handle'])
        self.assertEqual(self.post(self.a,'/api/posts',self.example()).status_code,403)
        self.assertEqual(self.post(self.a,'/api/logout',{},u['csrf']).status_code,200)
        self.assertIsNone(self.a.get(self.base+'/api/me').json()['user'])

    def test_wrong_password_and_origin(self):
        u=self.register(self.a,'who')
        r=self.post(self.b,'/api/login',{'handle':u['user']['handle'],'password':'wrong_password'})
        self.assertEqual(r.status_code,401)
        self.assertEqual(self.post(self.b,'/api/register',{'handle':'bad','password':'abcdefghijkl'},origin='https://evil.test').status_code,403)

    def test_post_create_private_coordinates_and_matches(self):
        usera=self.register(self.a,'driver')
        userb=self.register(self.b,'sender')
        ride=self.example(kind='ride',capacity=50,detour=10)
        a=self.post(self.a,'/api/posts',ride,usera['csrf'])
        self.assertEqual(a.status_code,201,a.text)
        ride_id=a.json()['id']
        pack=self.example(kind='package',start=(-23.73,-46.64),end=(-23.12,-46.96),capacity=12)
        b=self.post(self.b,'/api/posts',pack,userb['csrf'])
        self.assertEqual(b.status_code,201,b.text)
        records=self.a.get(self.base+'/api/posts?kind=package').json()['posts']
        self.assertEqual(len(records),1)
        self.assertEqual(records[0]['start_lat'],-23.73)
        self.assertNotIn('pass_hash',str(records))
        m=self.post(self.a,'/api/matches',{'ride_id':ride_id},usera['csrf'])
        self.assertEqual(m.status_code,200,m.text)
        result=m.json()
        self.assertEqual(result['calculation'],'geometric_lower_bound_only')
        self.assertEqual(len(result['matches']),1,result)
        self.assertIsNone(result['matches'][0]['compatibility']['estimated_minutes'])
        self.assertFalse(result['matches'][0]['compatibility']['road_route_confirmed'])
        # Overweight / oversize parcels cannot match
        self.assertIsNone(app.matching(ride|{'kind':'ride'},pack|{'kind':'package','capacity_kg':900}))
        self.assertIsNone(app.matching(ride|{'kind':'ride'},pack|{'kind':'package','length_cm':900}))
        self.assertEqual(self.post(self.b,'/api/matches',{'ride_id':ride_id},userb['csrf']).status_code,404)

    def test_proposals_message_permissions(self):
        driver=self.register(self.a,'offerdrv');ship=self.register(self.b,'offership')
        post_id=self.post(self.b,'/api/posts',self.example('package'),ship['csrf']).json()['id']
        r=self.post(self.a,'/api/offers',{'post_id':post_id,'message':'Posso retirar amanhã com cuidado.'},driver['csrf'])
        self.assertEqual(r.status_code,201,r.text)
        offer_id=r.json()['id']
        self.assertEqual(self.post(self.a,'/api/offers',{'post_id':post_id,'message':'Repito a proposta'},driver['csrf']).status_code,409)
        self.assertEqual(self.post(self.a,'/api/respond',{'offer_id':offer_id,'status':'accepted'},driver['csrf']).status_code,403)
        self.assertEqual(self.post(self.b,'/api/respond',{'offer_id':offer_id,'status':'accepted'},ship['csrf']).status_code,200)
        self.assertEqual(self.post(self.b,'/api/respond',{'offer_id':offer_id,'status':'rejected'},ship['csrf']).status_code,403)
        self.assertEqual(self.post(self.a,'/api/messages',{'offer_id':offer_id,'body':'Pode confirmar o tamanho?'},driver['csrf']).status_code,201)
        messages=self.b.get(self.base+f'/api/messages?offer_id={offer_id}').json()['messages']
        self.assertEqual(len(messages),1)
        self.assertEqual(messages[0]['body'],'Pode confirmar o tamanho?')
        intruder=requests.Session()
        self.assertEqual(intruder.get(self.base+f'/api/messages?offer_id={offer_id}').status_code,401)
        self.assertEqual(self.post(self.a,'/api/report',{'post_id':post_id,'reason':'Suspeita fundamentada'},driver['csrf']).status_code,201)

    def test_invalid_data_and_xss_content_never_in_static(self):
        u=self.register(self.a,'validate')
        invalid=self.example();invalid['departure']=int(time.time())-90000
        self.assertEqual(self.post(self.a,'/api/posts',invalid,u['csrf']).status_code,400)
        invalid=self.example();invalid['capacity_kg']=float('inf')
        # JS JSON serializes nonfinite to null; requests may forbid it, so test direct.
        with self.assertRaises(app.APIError):app.number(float('inf'),'capacity',0,100)
        invalid=self.example();invalid['title']='<img src=x onerror=alert(1)>'
        r=self.post(self.a,'/api/posts',invalid,u['csrf'])
        self.assertEqual(r.status_code,201,r.text)
        # data can contain text but frontend MUST escape HTML before insertion.
        js=Path(__file__).resolve().parents[1]/'static'/'app.js'
        self.assertIn('escapeHTML(p.title)',js.read_text())
        self.assertIn('textContent=m.body',js.read_text())
        records=self.a.get(self.base+'/api/posts').json()['posts']
        self.assertIn('<img',records[0]['title'])

    def test_geometric_rejects_wrong_direction_and_time(self):
        ride=self.example();pack=self.example('package',start=(-23.05,-46.94),end=(-23.75,-46.6))
        self.assertIsNone(app.matching(ride,pack))
        pack=self.example('package',start=(-23.76,-46.60),end=(-23.1,-46.91))
        pack['departure']+=8*3600
        self.assertIsNone(app.matching(ride,pack))

    def test_production_requires_db(self):
        self.assertTrue('DATABASE_URL is required' in Path(app.__file__).read_text())

if __name__=='__main__':unittest.main(verbosity=2)
