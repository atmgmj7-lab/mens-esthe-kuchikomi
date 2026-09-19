"""Independent transport boundary checks; all network and credential access stubbed."""
import importlib.util,pathlib,unittest,tempfile,json
from unittest.mock import MagicMock,patch
spec=importlib.util.spec_from_file_location('reviewed_client',pathlib.Path(__file__).with_name('client.py'))
client=importlib.util.module_from_spec(spec);spec.loader.exec_module(client)
class TransportReview(unittest.TestCase):
 def transport(self):
  t=object.__new__(client.Transport);t._auth='Basic local-fixture-only';return t
 def test_socket_target_and_tls_server_name(self):
  context=MagicMock();raw=MagicMock()
  with patch.object(client.socket,'create_connection',return_value=raw) as create:
   connection=client.PinnedTLS(client.HOST,timeout=3,context=context);connection.connect()
   create.assert_called_once_with((client.ORIGIN_IP,443),timeout=3)
   context.wrap_socket.assert_called_once_with(raw,server_hostname=client.HOST)
 def test_redirect_stops_without_following_or_reading_body(self):
  connection=MagicMock();response=connection.getresponse.return_value;response.status=302
  with patch.object(client,'PinnedTLS',return_value=connection) as factory:
   with self.assertRaisesRegex(client.SafeStop,'HTTP_REJECTED_OR_AMBIGUOUS_STOP'):
    self.transport().request('POST',client.PREFIX,{})
   self.assertEqual(factory.call_count,1);self.assertEqual(connection.request.call_count,1);response.read.assert_not_called();connection.close.assert_called_once()
 def test_exception_text_not_returned(self):
  connection=MagicMock();connection.request.side_effect=RuntimeError('fixture authorization material must not escape')
  with patch.object(client,'PinnedTLS',return_value=connection):
   with self.assertRaises(client.SafeStop) as caught:self.transport().request('GET',client.PREFIX+'/1')
   self.assertEqual(str(caught.exception),'TRANSPORT_AMBIGUOUS_STOP');connection.close.assert_called_once()
 def test_out_of_scope_path_never_connects(self):
  with patch.object(client,'PinnedTLS') as factory:
   with self.assertRaises(client.SafeStop):self.transport().request('POST','/wp-json/wp/v2/shops/1',{})
   factory.assert_not_called()
 def test_failed_cache_publication_journals_and_stops_after_readback(self):
  desired={'fields':{'shop_fact_provenance':{'exists':True,'value':[]}}}
  p={'wp_id':1,'slug':'one','batch_id':'batch','expected':{'fields':{}},'updates':{},'provenance':[]}
  class Fake:
   calls=[]
   def request(self,method,path,payload=None):
    self.calls.append((method,path))
    return {'state':'APPLIED','wp_id':1,'slug':'one','batch_id':'batch','snapshot':desired,'receipt':{'payload':{},'signature':'fixture'},'cache_published':False} if method=='POST' else desired
  with tempfile.TemporaryDirectory() as d:
   folder=pathlib.Path(d);transport=Fake()
   with self.assertRaisesRegex(client.SafeStop,'CACHE_PUBLICATION_STOP_AFTER_COMMIT'):
    client.execute([p,dict(p,wp_id=2,slug='two')],transport,folder)
   self.assertEqual(len(transport.calls),2)
   self.assertTrue((folder/'1-response.json').exists());self.assertTrue((folder/'1-readback.json').exists())
   self.assertFalse((folder/'2-request.json').exists())
if __name__=='__main__':unittest.main()
