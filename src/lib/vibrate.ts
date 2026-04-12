export const vibrate = (ms = 50) => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(ms);
  }
};
