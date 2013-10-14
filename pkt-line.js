"use strict";
var bops = require('bops');

var PACK = bops.from("PACK");

module.exports = {
  deframer: deframer,
  deframeMachine: deframeMachine,
  framer: framer,
  frame: frame
};

function deframer(emit) {
  var state = deframeMachine(emit);
  var working = false;

  return function (chunk) {
    if (working) throw new Error("parser is not re-entrant");
    working = true;
    // Once in raw mode, pass all data through.
    if (!state) return emit("pack", chunk);

    for (var i = 0, l = chunk.length; i < l; i++) {
      state = state(chunk[i]);
      if (state) continue;
      emit("pack", bops.subarray(chunk, i));
      break;
    }
    working = false;
  };
}

function deframeMachine(emit) {
  var offset, length, data, string, type;
  return reset();

  function reset() {
    offset = 4;
    length = 0;
    data = null;
    string = "";
    type = undefined;
    return $len;
  }

  function $len(byte) {
    var val = fromHexChar(byte);
    // If the byte isn't a hex char, it's bad input or it's raw PACK data.
    if (val === -1) {
      if (byte === PACK[0]) {
        offset = 1;
        return $maybeRaw;
      }
      throw new SyntaxError("Not a hex char: " + String.fromCharCode(byte));
    }
    length |= val << ((--offset) * 4);
    if (offset) return $len;
    if (length === 0) {
      offset = 4;
      emit("line", null);
      return $len;
    }
    if (length === 4) {
      offset = 4;
      emit("line", "");
      return $len;
    }
    if (length < 4) {
      throw new SyntaxError("Invalid length: " + length);
    }
    length -= 4;
    return $firstByte;
  }

  function $firstByte(byte) {
    if (byte === 1) {
      // PACK data in side-band
      length--;
      type = "pack";
      data = bops.create(length);
      return $binary;
    }
    if (byte === 2) {
      length--;
      type = "progress";
      string = "";
      return $string;
    }
    if (byte === 3) {
      length--;
      type = "error";
      string = "";
      return $string;
    }
    type = "line";
    offset++;
    string = String.fromCharCode(byte);
    return $string;
  }

  function $binary(byte) {
    data[offset] = byte;
    if (++offset < length) return $binary;
    emit(type, data);
    return reset();
  }

  function $string(byte) {
    string += String.fromCharCode(byte);
    if (++offset < length) return $string;
    emit(type, string);
    return reset();
  }

  function $maybeRaw(byte) {
    if (offset === 4) return emit("pack", PACK);
    if (byte === PACK[offset++]) return $maybeRaw;
    throw new SyntaxError("Invalid data in raw pack header");
  }

}

function framer(emit) {
  return function (type, value) {
    emit(frame(type, value));
  };
}

// Strings in line, progress, and error messages are assumed to be binary
// encoded.  If you want to send unicode data, please utf8 encode first.
function frame(type, value) {
  // Allow raw binary to be passed through
  if (value === undefined && bops.is(type)) return type;
  // Frame everything else using pkg-line framing and sidechannel multiplexing.
  var length, binary;
  if (type === "line") {
    if (value === null) return bops.from("0000");
    value = bops.from(value);
    length = value.length + 4;
    binary = bops.create(length);
    bops.copy(value, binary, 4);
  }
  else if (type === "pack") {
    length = value.length + 5;
    binary = bops.create(length);
    binary[4] = 1;
    bops.copy(value, binary, 5);
  }
  else if (type == "progress") {
    value = bops.from(value);
    length = value.length + 5;
    binary = bops.create(length);
    binary[4] = 2;
    bops.copy(value, binary, 5);
  }
  else if (type == "error") {
    value = bops.from(value);
    length = value.length + 5;
    binary = bops.create(length);
    binary[4] = 3;
    bops.copy(value, binary, 5);
  }
  else {
    throw new Error("Unknown type: " + type);
  }
  binary[0] = toHexChar(length >> 12 & 0xf);
  binary[1] = toHexChar(length >> 8 & 0xf);
  binary[2] = toHexChar(length >> 4 & 0xf);
  binary[3] = toHexChar(length & 0xf);
  return binary;
}

// Given the code for a hex character, return it's value.
function fromHexChar(val) {
  return val >= 0x30 && val <  0x40 ? val - 0x30 :
         val >  0x60 && val <= 0x66 ? val - 0x57 : -1;
}

function toHexChar(val) {
  return val < 0x0a ? val + 0x30 : val + 0x57;
}
