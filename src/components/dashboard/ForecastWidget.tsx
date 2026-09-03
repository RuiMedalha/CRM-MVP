import { useForecast } from '@/features/forecast/useForecast';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';

function MiniDelta({ value }: { value: number }) {
  if (value === 0) return <Minus className='h-3 w-3 text-muted-foreground' />;
  const positive = value > 0;
  return (
    <span className={'inline-flex items-center gap-0.5 text-xs font-medium ' + (positive ? 'text-emerald-600' : 'text-red-600')}>
      {positive ? <TrendingUp className='h-3 w-3' /> : <TrendingDown className='h-3 w-3' />}
      {positive ? '+' : ''}{value.toFixed(0)}%
    </span>
  );
}

export default function ForecastWidget() {
  const { isLoading, forecast30, deltaMonthPercent } = useForecast(30);

  return (
    <Card>
      <CardContent className='pt-4'>
        <div className='flex items-center justify-between mb-3'>
          <div className='flex items-center gap-2'>
            <Target className='h-4 w-4 text-primary' />
            <span className='text-sm font-medium'>Forecast 30d</span>
          </div>
          {!isLoading && <MiniDelta value={deltaMonthPercent} />}
        </div>
        {isLoading ? (
          <Skeleton className='h-10 w-full mb-2' />
        ) : (
          <p className='text-2xl font-bold text-blue-600 mb-1'>
            {forecast30.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
