"""Pinned TLS, no-redirect, no-retry client. Default is local preflight only.

Production execution requires all exact reviewed artifact hashes and an explicit
approval flag. Never logs credentials, response error bodies or exceptions.
"""
import argparse, base64, hashlib, http.client, json, os, pathlib, socket, ssl, subprocess
HOST='mens-esthe-kuchikomi.com'
ORIGIN_IP='85.131.213.108'
PREFIX='/wp-json/escomi/v1/official-facts'
class SafeStop(Exception): pass

def verified_file(path, expected_hash):
 raw=pathlib.Path(path).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=expected_hash: raise SafeStop('ARTIFACT_HASH_MISMATCH')
 return json.loads(raw)

def durable_new(path, value):
 path=pathlib.Path(path)
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:
  json.dump(value,f,ensure_ascii=False,indent=2);f.flush();os.fsync(f.fileno())
 directory=os.open(path.parent,os.O_RDONLY)
 try:os.fsync(directory)
 finally:os.close(directory)

def check_payloads(payloads):
 if not isinstance(payloads,list):raise SafeStop('INVALID_PAYLOAD_LIST')
 ids=set()
 for p in payloads:
  if not isinstance(p,dict) or type(p.get('wp_id')) is not int or p['wp_id']<=0 or not isinstance(p.get('slug'),str) or not p['slug'] or p['wp_id'] in ids:raise SafeStop('INVALID_OR_DUPLICATE_IDENTITY')
  ids.add(p['wp_id'])

class PinnedTLS(http.client.HTTPSConnection):
 def connect(self):
  raw=socket.create_connection((ORIGIN_IP,443),timeout=self.timeout)
  try:self.sock=self._context.wrap_socket(raw,server_hostname=HOST)
  except Exception:raw.close();raise

class Transport:
 def __init__(self):
  user=os.environ.get('WP_OFFICIAL_FACTS_USER','');password=os.environ.get('WP_OFFICIAL_FACTS_APP_PASSWORD','')
  if not user or not password or ':' in user or any(c in user+password for c in '\r\n'):raise SafeStop('DEDICATED_CREDENTIALS_NOT_AVAILABLE')
  self._auth='Basic '+base64.b64encode((user+':'+password).encode()).decode()
 def request(self, method, path, payload=None):
  if method not in ('GET','POST') or not (path==PREFIX or path.startswith(PREFIX+'/')):raise SafeStop('TRANSPORT_SCOPE_REJECTED')
  connection=PinnedTLS(HOST,timeout=30,context=ssl.create_default_context())
  body=None if payload is None else json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode()
  try:
   connection.request(method,path,body=body,headers={'Authorization':self._auth,'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache'})
   response=connection.getresponse()
   if response.status!=200:raise SafeStop('HTTP_REJECTED_OR_AMBIGUOUS_STOP')
   raw=response.read(1048577)
   if len(raw)>1048576:raise SafeStop('RESPONSE_LIMIT_STOP')
   result=json.loads(raw)
   if not isinstance(result,dict):raise SafeStop('RESPONSE_SCHEMA_STOP')
   return result
  except SafeStop:raise
  except Exception:raise SafeStop('TRANSPORT_AMBIGUOUS_STOP') from None
  finally:connection.close()

def execute(payloads, transport, journal):
 check_payloads(payloads)
 for p in payloads:
  name=str(p['wp_id'])
  durable_new(journal/(name+'-request.json'),p)
  # No retries; a lost response is a human read-only reconciliation stop.
  response=transport.request('POST',PREFIX,p)
  durable_new(journal/(name+'-response.json'),response)
  desired=dict(p['expected']);desired['fields']=dict(desired['fields'])
  for key,value in p['updates'].items():desired['fields'][key]={'exists':True,'value':str(value)}
  desired['fields']['shop_fact_provenance']={'exists':True,'value':p['provenance']}
  if response.get('wp_id')!=p['wp_id'] or response.get('slug')!=p['slug'] or response.get('batch_id')!=p['batch_id']:raise SafeStop('ACKNOWLEDGEMENT_IDENTITY_STOP')
  if response.get('state')=='APPLIED':
   if not isinstance(response.get('receipt'),dict) or response.get('snapshot')!=desired:raise SafeStop('ACKNOWLEDGEMENT_SCHEMA_STOP')
  elif response.get('state')!='NOOP':raise SafeStop('ACKNOWLEDGEMENT_SCHEMA_STOP')
  actual=transport.request('GET',PREFIX+'/'+name)
  durable_new(journal/(name+'-readback.json'),actual)
  if actual!=desired:raise SafeStop('READBACK_MISMATCH_STOP')
  if response.get('state')=='APPLIED' and response.get('cache_published') is not True:raise SafeStop('CACHE_PUBLICATION_STOP_AFTER_COMMIT')
 return len(payloads)

def check_code_revision(root,code_sha):
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
 dirty=subprocess.check_output(['git','diff','HEAD','--name-only','--','functions.php','shop-price-booking-public.php','official-facts-rest.php','official-facts-projection.php','shop-public-meta.php','scripts/area_official_sync_v2','headless/lib'],cwd=root,text=True).strip()
 tracked=subprocess.run(['git','ls-files','--error-unmatch','--','functions.php','shop-price-booking-public.php','official-facts-rest.php','official-facts-projection.php','scripts/area_official_sync_v2/client.py','scripts/area_official_sync_v2/provenance.mjs'],cwd=root,capture_output=True).returncode==0
 untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard','--','scripts/area_official_sync_v2'],cwd=root,text=True).splitlines()
 if head!=code_sha or dirty or not tracked or any(pathlib.Path(p).suffix in ('.py','.mjs','.php') for p in untracked):raise SafeStop('CODE_REVISION_MISMATCH')

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 for name in ('payloads','payloads-sha256','plan','plan-sha256','rollback','rollback-sha256','code-sha'):parser.add_argument('--'+name,required=True)
 parser.add_argument('--execute-approved-batch',action='store_true')
 parser.add_argument('--journal')
 args=parser.parse_args()
 check_code_revision(pathlib.Path(__file__).resolve().parents[2],args.code_sha)
 payloads=verified_file(args.payloads,args.payloads_sha256)
 for path,digest in ((args.plan,args.plan_sha256),(args.rollback,args.rollback_sha256)):
  if hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()!=digest:raise SafeStop('ARTIFACT_HASH_MISMATCH')
 check_payloads(payloads)
 if not args.execute_approved_batch:
  print(json.dumps({'state':'LOCAL_PREFLIGHT_ONLY','shops':len(payloads),'production_writes':0}));return
 if not args.journal or not payloads:raise SafeStop('EMPTY_PLAN_OR_MISSING_JOURNAL')
 journal=pathlib.Path(args.journal);journal.mkdir(mode=0o700,parents=False,exist_ok=False)
 durable_new(journal/'approved-plan.json',{'code_sha':args.code_sha,'payloads_sha256':args.payloads_sha256,'plan_sha256':args.plan_sha256,'rollback_sha256':args.rollback_sha256,'payloads':payloads})
 count=execute(payloads,Transport(),journal)
 print(json.dumps({'state':'REST_READBACK_PASS','shops':count,'public_hash_and_page_QA':'PENDING'}))
if __name__=='__main__':
 try:main()
 except SafeStop as error:raise SystemExit(str(error)) from None
 except Exception:raise SystemExit('LOCAL_OPERATION_FAILED; details withheld') from None
