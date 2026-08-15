import { Link } from 'react-router-dom';
import { Card } from '../components/Card.jsx';

export default function NotFound() {
  return (
    <Card className="p-8 text-center">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="mt-1.5 text-sm text-ink-secondary">
        That route is not part of the Wasste prototype.
      </p>
      <Link
        to="/"
        className="mt-5 inline-block rounded-lg bg-ink px-3.5 py-2 text-xs font-semibold text-surface transition-opacity hover:opacity-85"
      >
        Back to the city overview
      </Link>
    </Card>
  );
}
