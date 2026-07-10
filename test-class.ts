const state = 'accent';
const isCurrentVisualBeat = true;

let circleClass = 'rounded-full transition-[filter,opacity,box-shadow,background-color] duration-100 ease-out flex items-center justify-center ';
if (state === 'accent') {
  circleClass += 'w-7 h-7 md:w-8 md:h-8 border-2 border-brand bg-brand ';
  if (isCurrentVisualBeat) {
    circleClass += 'brightness-125 shadow-[0_0_14px_rgba(var(--brand),0.8)]';
  }
}
console.log(circleClass);
