import { Filters } from '../board/Board'
type Props = { open: boolean } & Omit<React.ComponentProps<typeof Filters>, 'visibility'> & { visibility: React.ComponentProps<typeof Filters>['visibility'] }
export function FiltersBar({ open, ...props }: Props) { return open ? <Filters {...props} /> : null }
