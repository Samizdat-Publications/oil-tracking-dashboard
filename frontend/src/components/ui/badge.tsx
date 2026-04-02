import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent text-white',
        secondary: 'border-transparent bg-surface text-text-secondary',
        outline: 'border-border text-text-secondary',
        war: 'border-transparent bg-red/20 text-red',
        embargo: 'border-transparent bg-orange/20 text-orange',
        revolution: 'border-transparent bg-yellow/20 text-yellow',
        pandemic: 'border-transparent bg-purple/20 text-purple',
        market: 'border-transparent bg-accent/20 text-accent',
        opec: 'border-transparent bg-green/20 text-green',
        custom: 'border-transparent bg-cyan/20 text-cyan',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
