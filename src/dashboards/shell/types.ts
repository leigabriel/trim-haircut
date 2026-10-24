import type { IconComponent } from 'reicon-react/createIcon';

/**
 * One entry in a dashboard rail. The id is the view key the owning dashboard
 * switches on, so the shell never needs to know which dashboard it is drawing.
 */
export interface DashboardNavItem {
  id: string;
  label: string;
  /** Reicon component. Drawn at 20px, outline weight. */
  icon: IconComponent;
}
