import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseText} from '../app/js/cleanup.js';

test('WebVTT auto captions remove rolling duplicates and tags while keeping their source times',()=>{
  const text='WEBVTT\nKind: captions\nLanguage: vi\n\n00:00:00.160 --> 00:00:02.389 align:start position:0%\n \nXin<00:00:00.399><c> chào.</c>\n\n00:00:02.389 --> 00:00:02.399\nXin chào.\n\n00:00:02.399 --> 00:00:04.190\nXin chào.\nCờ<00:00:03.000><c> trắng</c> &amp; đàm phán.\n';
  assert.deepEqual(parseText(text),[{t:0.16,text:'Xin chào.'},{t:2.399,text:'Cờ trắng & đàm phán.'}]);
});
test('manual WebVTT keeps deliberate repetitions and skips non-caption blocks',()=>{
  const text='\ufeffWEBVTT\n\nNOTE ghi chú\nKhông đưa vào nội dung\n\n1\n00:00:01.000 --> 00:00:02.000\nKhông.\n\n2\n00:00:02.000 --> 00:00:03.000\nKhông.\n';
  assert.deepEqual(parseText(text),[{t:1,text:'Không.'},{t:2,text:'Không.'}]);
});
