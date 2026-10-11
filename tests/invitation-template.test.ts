import test from 'node:test';import assert from 'node:assert/strict';
import {invitationDefaults,validateInvitationTemplate,renderInvitation} from '../src/domain/invitation-template';
test('invitation draft enforces known placeholders, a single setup link and explicit expiry',()=>{
 assert.deepEqual(validateInvitationTemplate(invitationDefaults),invitationDefaults);
 for(const body of ['No link','{{setup_link}} {{setup_link}} {{expiry}}','{{setup_link}} {{expiry}} {{password}}','{{setup_link}} {{expiry}} {broken}'])assert.throws(()=>validateInvitationTemplate({...invitationDefaults,body}));
 assert.throws(()=>validateInvitationTemplate({...invitationDefaults,subject:'Hello\r\nBcc: private'}));
 assert.throws(()=>validateInvitationTemplate({...invitationDefaults,subject:'{{setup_link}}'}));
});
test('rendering escapes recipient and plain text without emailing a password',()=>{
 const result=renderInvitation(invitationDefaults,'<img src=x>\nMember','https://example.invalid/invitation#token=synthetic');
 assert.ok(result.html.includes('&lt;img'));assert.ok(!result.html.includes('<img'));assert.ok(result.html.includes('Set your password'));
 assert.ok(result.text.includes('48 hours'));assert.throws(()=>renderInvitation(invitationDefaults,'Member','javascript:alert(1)'));
});
