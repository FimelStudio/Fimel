import { useSyncExternalStore, type RefObject } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

const subscribeVisibility = (callback: () => void) => {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
};

const getPageVisibility = () => !document.hidden;
const getServerVisibility = () => true;

export function usePageVisible() {
  return useSyncExternalStore(subscribeVisibility, getPageVisibility, getServerVisibility);
}

const pointerQuery = '(hover: hover) and (pointer: fine)';
const subscribePointer = (callback: () => void) => {
  const query = window.matchMedia(pointerQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
};
const getFinePointer = () => window.matchMedia(pointerQuery).matches;
const getServerPointer = () => false;

export function useFinePointer() {
  return useSyncExternalStore(subscribePointer, getFinePointer, getServerPointer);
}

export function useAnimationActivity(ref: RefObject<HTMLElement | null>) {
  const pageVisible = usePageVisible();
  const inView = useInView(ref, { margin: '100px', amount: 'some' });
  const reducedMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const device = typeof navigator === 'undefined' ? undefined : navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const constrained = !finePointer || Boolean(device?.connection?.saveData) ||
    Boolean(device?.hardwareConcurrency && device.hardwareConcurrency <= 4) ||
    Boolean(device?.deviceMemory && device.deviceMemory <= 4);

  return { active: pageVisible && inView, reducedMotion: Boolean(reducedMotion), constrained };
}
