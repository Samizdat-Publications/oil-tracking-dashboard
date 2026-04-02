import { useState } from 'react';
import { Droplets, ExternalLink, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { configureKeys } from '../../lib/api';

interface SetupScreenProps {
  onComplete: () => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [fredKey, setFredKey] = useState('');
  const [eiaKey, setEiaKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!fredKey.trim()) {
      setError('FRED API key is required');
      return;
    }

    setStatus('checking');
    setError('');

    try {
      await configureKeys(fredKey.trim(), eiaKey.trim() || undefined);
      setStatus('valid');
      setTimeout(onComplete, 1000);
    } catch (err) {
      setStatus('invalid');
      setError(err instanceof Error ? err.message : 'Validation failed');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="border border-accent/20 p-4">
              <Droplets className="h-10 w-10 text-accent" />
            </div>
          </div>
          <CardTitle className="text-xl">Oil Price Tracker</CardTitle>
          <CardDescription className="text-sm">
            Configure your API keys to get started with real-time oil price data and analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-primary font-[family-name:var(--font-display)] tracking-wider uppercase">FRED API Key *</label>
              <a
                href="https://fred.stlouisfed.org/docs/api/api_key.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-accent hover:underline flex items-center gap-0.5"
              >
                Get a key <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <input
              type="text"
              value={fredKey}
              onChange={(e) => setFredKey(e.target.value)}
              placeholder="Enter your FRED API key"
              className="flex h-9 w-full border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent/30 font-[family-name:var(--font-mono)]"
            />
            <p className="text-[10px] text-text-secondary">
              Required for WTI & Brent crude oil price data from the Federal Reserve.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-primary font-[family-name:var(--font-display)] tracking-wider uppercase">EIA API Key (optional)</label>
              <a
                href="https://www.eia.gov/opendata/register.php"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-accent hover:underline flex items-center gap-0.5"
              >
                Get a key <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <input
              type="text"
              value={eiaKey}
              onChange={(e) => setEiaKey(e.target.value)}
              placeholder="Enter your EIA API key (optional)"
              className="flex h-9 w-full border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent/30 font-[family-name:var(--font-mono)]"
            />
            <p className="text-[10px] text-text-secondary">
              Enables downstream indicators (diesel, jet fuel, gasoline) and correlation analysis.
            </p>
          </div>

          {status === 'checking' && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validating keys...
            </div>
          )}
          {status === 'valid' && (
            <div className="flex items-center gap-2 text-sm text-green">
              <CheckCircle className="h-4 w-4" />
              Keys validated successfully! Redirecting...
            </div>
          )}
          {status === 'invalid' && (
            <div className="flex items-center gap-2 text-sm text-red">
              <XCircle className="h-4 w-4" />
              {error || 'Invalid API key. Please check and try again.'}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={status === 'checking' || !fredKey.trim()}
          >
            {status === 'checking' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              'VALIDATE & SAVE'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
