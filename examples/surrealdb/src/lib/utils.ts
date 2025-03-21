// @ts-nocheck

export function once(fn: (event: Event) => void) {
  return function (event: Event) {
    if (fn) fn.call(this, event);
    fn = null;
  };
}

export function preventDefault(fn: (event: Event) => void) {
  return function (event: Event) {
    event.preventDefault();
    fn.call(this, event);
  };
}
