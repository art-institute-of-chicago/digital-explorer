import { useRef } from 'react';
import sendGAEvent from '../lib/utils/sendGAEvent';

export default function BrailleGestureButton({
  onSingleTap,
  onDoubleTap,
  onTripleTap,
  onLongPress,
  isVOActive
}) {
  const lastTapTime = useRef(0);
  const tapCount = useRef(0);
  const pressTimer = useRef(null);
  const isLongPressActive = useRef(false);

  const handlePointerDown = (e) => {
    isLongPressActive.current = false;
    // Detect Long Press (1 second)
    pressTimer.current = setTimeout(() => {
      sendGAEvent({ eventCategory: 'Braille Button', eventAction: 'click', eventLabel: 'Long Press' });
      onLongPress?.();
      isLongPressActive.current = true;
      tapCount.current = 0; // Reset taps if long press triggered
    }, 1000);
  };

  const handlePointerUp = (e) => {
    clearTimeout(pressTimer.current);

    // If it was a long press, don't process as a tap
    if (isLongPressActive.current) return;

    const currentTime = Date.now();
    const gap = currentTime - lastTapTime.current;

    // Reset count if the gap between taps is too long (e.g., > 350ms)
    if (gap > 350) {
      tapCount.current = 1;
    } else {
      tapCount.current += 1;
    }

    lastTapTime.current = currentTime;

    // This keeps the "User Activation" context alive for SpeechSynthesis
    if (tapCount.current === 1) {
      // We wrap this in a tiny delay ONLY if we want to wait for a potential second tap
      // BUT for "Voice Over On" (Triple Tap), we want it to feel responsive.
      sendGAEvent({ eventCategory: 'Braille Button', eventAction: 'click', eventLabel: 'Single Tap' });
      onSingleTap?.();
    } else if (tapCount.current === 2) {
      sendGAEvent({ eventCategory: 'Braille Button', eventAction: 'click', eventLabel: 'Double Tap' });
      onDoubleTap?.();
    } else if (tapCount.current === 3) {
      sendGAEvent({ eventCategory: 'Braille Button', eventAction: 'click', eventLabel: 'Triple Tap' });
      onTripleTap?.();
      tapCount.current = 0; // Reset after triple
    }
  };

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'absolute', bottom: '0', right: '0',
        width: '250px', height: '250px',
        background: isVOActive ? 'rgba(188, 188, 188, 0.1)' : 'transparent',
        border: 'none', zIndex: 60, cursor: 'pointer', outline: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      aria-label="Tactile Navigation Area"
    />
  );
}