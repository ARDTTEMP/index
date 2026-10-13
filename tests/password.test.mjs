import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordValid} from '../lib/password.ts';
test('New passwords require 8 characters and all four character groups',()=>{
 assert.equal(passwordValid('Abcdef1!'),true);
 for(const value of ['Abcd1!','abcdefgh','ABCDEFGH1!','abcdefgh1!','Abcdefgh!','Abcdefg1','Abcdef1 ','Abcdef1é']) assert.equal(passwordValid(value),false,value);
 assert.equal(passwordValid('A1!'+ 'a'.repeat(126)),false);
});
