import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface TableColumn {
  header: string;
  accessor: string;
}

interface TableProps {
  columns: TableColumn[];
  data: Record<string, ReactNode>[];
  className?: string;
}

export function Table({ columns, data, className }: TableProps) {
  return (
    <div className={cn('overflow-x-auto rounded-lg', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-primary">
            {columns.map((column) => (
              <th
                key={column.accessor}
                className="px-4 py-3 text-left text-white font-bold text-sm"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                'border-b border-gray-light',
                rowIndex % 2 === 0 ? 'bg-bg-primary' : 'bg-bg-secondary'
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.accessor}
                  className="px-4 py-3 text-text-DEFAULT text-sm"
                >
                  {row[column.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
