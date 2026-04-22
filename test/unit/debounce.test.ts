import { describe, expect, jest, test, beforeEach, afterEach } from "@jest/globals";
import { debounce } from '../../wasp-app/src/client/utils/debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('invokes callback once with the latest value after delay', () => {
    const spy = jest.fn();
    const debounced = debounce(spy, 150);

    debounced('a');
    debounced('ab');
    debounced('abc');

    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(149);
    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('abc');
  });
});
