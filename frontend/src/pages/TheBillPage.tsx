/**
 * V5 route wrapper. The page itself is `src/v5/TheBill.jsx`, a port of
 * Design's prototype; this file exists only so the lazy route has a .tsx
 * entry point like the others.
 */
// @ts-expect-error - ported prototype, deliberately untyped JS
import TheBill from '../v5/TheBill.jsx';

export default function TheBillPage() {
  return <TheBill />;
}
