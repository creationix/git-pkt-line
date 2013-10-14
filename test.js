"use strict";

var pktLine = require('./.');
var bops = require('bops');
var test = require('tape');

// Some canned data manually broken up at weird places to test deframing logic
var chunked = [
  '002bgit-upload-pack /js-git',
  '\0host=localhost\0',
  '00ad52bc15b3e685afe74f8331bade5ed992b8ae',
  'edee HEAD\0multi_ack thin-pack side-b',
  'and side-band-64k ofs-delta shallow no-pro',
  'gress include-tag multi_ack_detailed agent=',
  'git/1.8.1.2\n003f52bc15b3e685afe74f8331bade5',
  'ed992b8aeedee refs/heads/master\n004652bc15b3',
  'e685afe74f8331bade5ed992b8aeedee refs/remotes/o',
  'rigin/HEAD\n004852bc15b3e685afe74f8331bade5ed992',
  'b8aeedee refs/remotes/origin/master\n000000040007',
  'hi\n0032want 0000000000000000000000000000000000000',
  '000\n0000001bhi\0ofs-delta hat party\nPACKhelloworld',
  'this is a long binary blob right? Right!'
];

var messages = [
  ["line", "git-upload-pack /js-git\0host=localhost\0"],
  ["line", "52bc15b3e685afe74f8331bade5ed992b8aeedee HEAD\0multi_ack thin-pack side-band side-band-64k ofs-delta shallow no-progress include-tag multi_ack_detailed agent=git/1.8.1.2\n"],
  ["line", "52bc15b3e685afe74f8331bade5ed992b8aeedee refs/heads/master\n"],
  ["line", "52bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/HEAD\n"],
  ["line", "52bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/master\n"],
  ["line", null],  // pkt-flush events are encoded as null
  ["line", ""],    // So they can be distinguished from empty strings
  ["line", "hi\n"],
  ["line", "want 0000000000000000000000000000000000000000\n"],
  ["line", null],
  ["line", "hi\0ofs-delta hat party\n"],
  ["pack", bops.from("PACK")],
  ["pack", bops.from("helloworld")],
  ["pack", bops.from("this is a long binary blob right? Right!")]
];

var framed = [
  "002bgit-upload-pack /js-git\0host=localhost\0",
  "00ad52bc15b3e685afe74f8331bade5ed992b8aeedee HEAD\0multi_ack thin-pack side-band side-band-64k ofs-delta shallow no-progress include-tag multi_ack_detailed agent=git/1.8.1.2\n",
  "003f52bc15b3e685afe74f8331bade5ed992b8aeedee refs/heads/master\n",
  "004652bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/HEAD\n",
  "004852bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/master\n",
  "0000",
  "0004",
  "0007hi\n",
  "0032want 0000000000000000000000000000000000000000\n",
  "0000",
  "001bhi\0ofs-delta hat party\n",
  "PACK", "helloworld",
  "this is a long binary blob right? Right!"
];

var chunked2 = [
  '002bgit-upload-pack /js-git\u0000host=localhost',
  '\u000000ad52bc15b3e685afe74f8331bade5ed992b8aee',
  'dee HEAD\u0000multi_ack thin-pack side-band sid',
  'e-band-64k ofs-delta shallow no-progress includ',
  'e-tag multi_ack_detailed agent=git/1.8.1.2\n003',
  'f52bc15b3e685afe74f8331bade5ed992b8aeedee refs/',
  'heads/master\n004652bc15b3e685afe74f8331bade5ed',
  '992b8aeedee refs/remotes/origin/HEAD\n004852bc1',
  '5b3e685afe74f8331bade5ed992b8aeedee refs/remote',
  's/origin/master\n000000040007hi\n0032want 00000',
  '00000000000000000000000000000000000\n0000001bhi',
  '\u0000ofs-delta hat party\n0013\u0001PACKhellow',
  'orld0020\u0002This is a progress message\r0021',
  '\u0002This is a progress message.\r0022\u0002Th',
  'is is a progress message..\r0018\u0003There was',
  ' an error\n002d\u0001this is a long binary blob',
  ' right? Right!'
];

var messages2 = [
  ["line", "git-upload-pack /js-git\0host=localhost\0"],
  ["line", "52bc15b3e685afe74f8331bade5ed992b8aeedee HEAD\0multi_ack thin-pack side-band side-band-64k ofs-delta shallow no-progress include-tag multi_ack_detailed agent=git/1.8.1.2\n"],
  ["line", "52bc15b3e685afe74f8331bade5ed992b8aeedee refs/heads/master\n"],
  ["line", "52bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/HEAD\n"],
  ["line", "52bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/master\n"],
  ["line", null],  // pkt-flush events are encoded as null
  ["line", ""],    // So they can be distinguished from empty strings
  ["line", "hi\n"],
  ["line", "want 0000000000000000000000000000000000000000\n"],
  ["line", null],
  ["line", "hi\0ofs-delta hat party\n"],
  ["pack", bops.from("PACKhelloworld")],
  ["progress", "This is a progress message\r"],
  ["progress", "This is a progress message.\r"],
  ["progress", "This is a progress message..\r"],
  ["error", "There was an error\n"],
  ["pack", bops.from("this is a long binary blob right? Right!")]
];

var framed2 = [
  '002bgit-upload-pack /js-git\u0000host=localhost\u0000',
  '00ad52bc15b3e685afe74f8331bade5ed992b8aeedee HEAD\u0000multi_ack thin-pack side-band side-band-64k ofs-delta shallow no-progress include-tag multi_ack_detailed agent=git/1.8.1.2\n',
  '003f52bc15b3e685afe74f8331bade5ed992b8aeedee refs/heads/master\n',
  '004652bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/HEAD\n',
  '004852bc15b3e685afe74f8331bade5ed992b8aeedee refs/remotes/origin/master\n',
  '0000',
  '0004',
  '0007hi\n',
  '0032want 0000000000000000000000000000000000000000\n',
  '0000',
  '001bhi\u0000ofs-delta hat party\n',
  '0013\u0001PACKhelloworld',
  '0020\u0002This is a progress message\r',
  '0021\u0002This is a progress message.\r',
  '0022\u0002This is a progress message..\r',
  '0018\u0003There was an error\n',
  '002d\u0001this is a long binary blob right? Right!'
];


function toBinary(string) {
  if (string === null || string === true) return string;
  if (typeof string !== "string") return string;
  return bops.from(string);
}

function toString(binary) {
  if (binary === null || binary === true) return binary;
  return bops.to(binary);
}

test('decoder works with no side-channel', function(assert) {

  var items = [];
  chunked.map(toBinary).forEach(pktLine.deframer(function (type, value) {
    items.push([type, value]);
  }));
  items.forEach(function (item, i) {
    if (bops.is(item[1])) {
      assert.equal(item[0], messages[i][0]);
      assert.equal(bops.to(item[1]), bops.to(messages[i][1]));
    }
    else {
      assert.deepEqual(item, messages[i]);
    }
  });
  assert.equal(items.length, messages.length);
  assert.end();

});

test('decoder works with side-channel', function(assert) {

  var items = [];
  chunked2.map(toBinary).forEach(pktLine.deframer(function (type, value) {
    items.push([type, value]);
  }));
  items.forEach(function (item, i) {
    if (bops.is(item[1])) {
      assert.equal(item[0], messages2[i][0]);
      assert.equal(bops.to(item[1]), bops.to(messages2[i][1]));
    }
    else {
      assert.deepEqual(item, messages2[i]);
    }
  });
  assert.equal(items.length, messages2.length);
  assert.end();

});

test('encoder works with no side-channel', function(assert) {

  var items = [];
  var write = pktLine.framer(function (item) {
    items.push(item);
  });
  messages.forEach(function (pair) {
    if (pair[0] === "pack") write(pair[1]);
    else write(pair[0], pair[1]);
  });

  items = items.map(toString);
  items.forEach(function (item, i) {
    assert.equal(item, framed[i]);
  });
  assert.equal(items.length, framed.length);
  assert.end();

});

test('encoder works with side-channel', function(assert) {

  var items = [];
  var write = pktLine.framer(function (item) {
    items.push(item);
  });
  messages2.forEach(function (pair) {
    write(pair[0], pair[1]);
  });

  items = items.map(toString);
  items.forEach(function (item, i) {
    assert.equal(item, framed2[i]);
  });
  assert.equal(items.length, framed2.length);
  assert.end();

});
