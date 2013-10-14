git-pkt-line
============

pkt-line encoder and decoder in pure JS.

## pktLine.deframer(onItem) - onChunk

Given an `onItem` event handler, returns a function where you can write raw TCP chunks.

The `onChunk` function has the signature `onChunk(binary)`.

The `onItem` function has the signature `onItem(type, value)` where type can be one of `"pack"`, `"line"`, `"progress"`, or `"error"`.

```js
// example using node push streams.
stream.on('data', pktLine.deframer(function (type, value) {
  ...
});
```


## pktLine.framer(onChunk) -> onItem

Given an `onChunk` event handler, returns a function where you can write

```js
var write = pktLine.framer(function (chunk) {
  stream.write(chunk);
});

write("progress", "Send custom progress data in the sidechannel\r");
```

## pktLine.deframeMachine(onItem) -> initialState

The nestable state-machine used internally by `pktLine-deframer`.

## pktLine.frame(item) -> chunk

The simple function used internally by `pktLine.framer`.
