import importlib.util, pathlib, tempfile, unittest, json, hashlib
SPEC=importlib.util.spec_from_file_location('client',pathlib.Path(__file__).with_name('client.py'))
client=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(client)
class ClientContract(unittest.TestCase):
 def test_hash_reject(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'p';p.write_text('[]')
   with self.assertRaises(client.SafeStop): client.verified_file(p,'0'*64)
 def test_journal_private_exclusive(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'j';client.durable_new(p,{'state':'PREPARED'})
   self.assertEqual(p.stat().st_mode&0o777,0o600)
   with self.assertRaises(FileExistsError):client.durable_new(p,{})
 def test_duplicates_rejected(self):
  with self.assertRaises(client.SafeStop):client.check_payloads([{'wp_id':1,'slug':'a'},{'wp_id':1,'slug':'a'}])
 def test_no_retry_on_failure(self):
  class Transport:
   calls=0
   def request(self,*args): self.calls+=1;raise client.SafeStop('AMBIGUOUS_HTTP')
  with tempfile.TemporaryDirectory() as d:
   t=Transport()
   with self.assertRaises(client.SafeStop):client.execute([{'wp_id':1,'slug':'a','expected':{}}],t,pathlib.Path(d))
   self.assertEqual(t.calls,1)
 def test_readback_mismatch_stops(self):
  class Transport:
   calls=0
   def request(self,method,*args):
    self.calls+=1
    return {'state':'APPLIED','wp_id':1,'slug':'a','batch_id':'b','snapshot':{'fields':{'shop_fact_provenance':{'exists':True,'value':[]}}},'receipt':{'x':1}} if method=='POST' else {'wp_id':2}
  with tempfile.TemporaryDirectory() as d:
   t=Transport()
   with self.assertRaises(client.SafeStop):client.execute([{'wp_id':1,'slug':'a','batch_id':'b','expected':{'fields':{}},'updates':{},'provenance':[]}],t,pathlib.Path(d))
   self.assertEqual(t.calls,2)
 def test_dryrun_no_auth(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'p';p.write_text('[]')
   self.assertEqual(client.verified_file(p,hashlib.sha256(b'[]').hexdigest()),[])

class FoundationReadback(unittest.TestCase):
 def test_two_fields_exact_readback_and_mismatch(self):
  import copy
  for field,value in [('price_90','15000'),('shop_booking_url','https://booking.example/reserve?shop=one&course=90')]:
   for mismatch in [False,True]:
    expected={'wp_id':1,'slug':'one','status':'publish','area':[1],'fields':{field:{'exists':False,'value':None},'price_60':{'exists':True,'value':'9000'},'shop_fact_provenance':{'exists':False,'value':None}}}
    p={'wp_id':1,'slug':'one','batch_id':'batch','expected':expected,'updates':{field:value},'provenance':[]}
    desired=copy.deepcopy(expected);desired['fields'][field]={'exists':True,'value':value};desired['fields']['shop_fact_provenance']={'exists':True,'value':[]}
    class LocalTransport:
     calls=0
     def request(self,method,path,payload=None):
      self.calls+=1
      if method=='POST':return {'state':'APPLIED','wp_id':1,'slug':'one','batch_id':'batch','snapshot':desired,'receipt':{'fixture':True},'cache_published':True}
      actual=copy.deepcopy(desired)
      if mismatch:actual['fields'][field]['value']='unexpected'
      return actual
    with tempfile.TemporaryDirectory() as d:
     t=LocalTransport()
     if mismatch:
      with self.assertRaisesRegex(client.SafeStop,'READBACK_MISMATCH_STOP'):client.execute([p],t,pathlib.Path(d))
     else:self.assertEqual(client.execute([p],t,pathlib.Path(d)),1)
     self.assertEqual(t.calls,2)


class RevisionGate(unittest.TestCase):
 def test_runtime_includes_are_tracked_and_clean(self):
  import subprocess
  for target in ['functions.php','shop-price-booking-public.php']:
   with tempfile.TemporaryDirectory() as folder:
    root=pathlib.Path(folder)
    def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True,stderr=subprocess.DEVNULL).strip()
    git('init');git('config','user.email','fixture@example.invalid');git('config','user.name','Fixture')
    paths=['official-facts-rest.php','official-facts-projection.php','shop-public-meta.php','scripts/area_official_sync_v2/client.py','scripts/area_official_sync_v2/provenance.mjs','functions.php','shop-price-booking-public.php']
    for path in paths:
     file=root/path;file.parent.mkdir(parents=True,exist_ok=True);file.write_text('fixture')
    git('add','--',*paths);git('commit','-m','fixture');sha=git('rev-parse','HEAD')
    client.check_code_revision(root,sha)
    (root/target).write_text('changed')
    with self.assertRaisesRegex(client.SafeStop,'CODE_REVISION_MISMATCH'):client.check_code_revision(root,sha)
    git('checkout','--',target);git('rm','--cached',target);git('commit','-m','remove tracked include');sha=git('rev-parse','HEAD')
    with self.assertRaisesRegex(client.SafeStop,'CODE_REVISION_MISMATCH'):client.check_code_revision(root,sha)

if __name__=='__main__':unittest.main()
