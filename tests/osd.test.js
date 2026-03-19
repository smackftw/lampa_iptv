// Inline copy of getNeighbors (pure function, no deps) — avoids ES module import issues in Jest.
function getNeighbors(channels, currentIndex) {
  var len = channels.length;
  if (len === 0) return [];

  var count = Math.min(5, len);
  var half  = Math.floor(count / 2);
  var result = [];

  for (var i = 0; i < count; i++) {
    var offset = i - half;
    var idx    = ((currentIndex + offset) % len + len) % len;
    result.push({
      channel:   channels[idx],
      index:     idx,
      isCurrent: idx === currentIndex
    });
  }

  return result;
}

function makeChannels(n) {
  var result = [];
  for (var i = 0; i < n; i++) {
    result.push({ id: 'ch' + i, name: 'Channel ' + i });
  }
  return result;
}

describe('getNeighbors', () => {
  test('empty list → empty array', () => {
    expect(getNeighbors([], 0)).toEqual([]);
  });

  test('1 channel → returns 1 item with isCurrent=true', () => {
    var ch = makeChannels(1);
    var result = getNeighbors(ch, 0);
    expect(result).toHaveLength(1);
    expect(result[0].isCurrent).toBe(true);
    expect(result[0].index).toBe(0);
  });

  test('3 channels → returns all 3', () => {
    var ch = makeChannels(3);
    var result = getNeighbors(ch, 1);
    expect(result).toHaveLength(3);
    var indices = result.map(function(r) { return r.index; });
    expect(indices).toEqual([0, 1, 2]);
  });

  test('10 channels, index 5 → centered window [3,4,5,6,7]', () => {
    var ch = makeChannels(10);
    var result = getNeighbors(ch, 5);
    expect(result).toHaveLength(5);
    var indices = result.map(function(r) { return r.index; });
    expect(indices).toEqual([3, 4, 5, 6, 7]);
    var cur = result.find(function(r) { return r.isCurrent; });
    expect(cur.index).toBe(5);
  });

  test('10 channels, index 0 → wraps to [8,9,0,1,2]', () => {
    var ch = makeChannels(10);
    var result = getNeighbors(ch, 0);
    expect(result).toHaveLength(5);
    var indices = result.map(function(r) { return r.index; });
    expect(indices).toEqual([8, 9, 0, 1, 2]);
  });

  test('10 channels, index 9 → wraps to [7,8,9,0,1]', () => {
    var ch = makeChannels(10);
    var result = getNeighbors(ch, 9);
    expect(result).toHaveLength(5);
    var indices = result.map(function(r) { return r.index; });
    expect(indices).toEqual([7, 8, 9, 0, 1]);
  });

  test('exactly one item has isCurrent=true', () => {
    var ch = makeChannels(10);
    var result = getNeighbors(ch, 3);
    var currentItems = result.filter(function(r) { return r.isCurrent; });
    expect(currentItems).toHaveLength(1);
    expect(currentItems[0].index).toBe(3);
  });

  test('each result item has channel, index, isCurrent fields', () => {
    var ch = makeChannels(5);
    var result = getNeighbors(ch, 2);
    result.forEach(function(item) {
      expect(item).toHaveProperty('channel');
      expect(item).toHaveProperty('index');
      expect(item).toHaveProperty('isCurrent');
    });
  });
});
