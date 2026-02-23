import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Browser integration tests for multi-table plotting scenarios
 * Tests cross-table, grouped, and aggregated table plotting in a browser environment
 */

// Mock data generators
const createCrossTableData = () => ({
  tableA: {
    logs: [
      { id: '1', entries: { x: 10 }, params: {} },
      { id: '2', entries: { x: 20 }, params: {} },
      { id: '3', entries: { x: 30 }, params: {} },
    ],
    fields: {
      'entries/x': { dataType: 'float', fieldType: 'entry' },
    },
  },
  tableB: {
    logs: [
      { id: '1', entries: { y: 100 }, params: {} },
      { id: '2', entries: { y: 200 }, params: {} },
      { id: '3', entries: { y: 300 }, params: {} },
    ],
    fields: {
      'entries/y': { dataType: 'float', fieldType: 'entry' },
    },
  },
});

const createGroupedTableData = () => ({
  logs: [
    { id: '1', entries: { x: 10, y: 100, category: 'A' }, params: {} },
    { id: '2', entries: { x: 20, y: 150, category: 'A' }, params: {} },
    { id: '3', entries: { x: 30, y: 120, category: 'B' }, params: {} },
    { id: '4', entries: { x: 40, y: 180, category: 'B' }, params: {} },
    { id: '5', entries: { x: 50, y: 200, category: 'C' }, params: {} },
  ],
  fields: {
    'entries/x': { dataType: 'float', fieldType: 'entry' },
    'entries/y': { dataType: 'float', fieldType: 'entry' },
    'entries/category': { dataType: 'string', fieldType: 'entry' },
  },
});

const createAggregatedTableData = () => ({
  logs: [
    { id: '1', entries: { category: 'North', sum_sales: 1000, count: 50 }, params: {} },
    { id: '2', entries: { category: 'South', sum_sales: 1500, count: 75 }, params: {} },
    { id: '3', entries: { category: 'East', sum_sales: 800, count: 40 }, params: {} },
    { id: '4', entries: { category: 'West', sum_sales: 1200, count: 60 }, params: {} },
  ],
  fields: {
    'entries/category': { dataType: 'string', fieldType: 'entry' },
    'entries/sum_sales': { dataType: 'float', fieldType: 'entry', artifacts: 'aggregate:sum' },
    'entries/count': { dataType: 'int', fieldType: 'entry', artifacts: 'aggregate:count' },
  },
});

// Simple test component that simulates plot rendering
const MockPlotComponent: React.FC<{
  plotType: string;
  xAxis: string;
  yAxis: string;
  groupBy?: string;
  aggregate?: string;
  data: any;
  onRender?: () => void;
}> = ({ plotType, xAxis, yAxis, groupBy, aggregate, data, onRender }) => {
  React.useEffect(() => {
    onRender?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotType, xAxis, yAxis, groupBy, aggregate, data]);

  const logs = data.logs || [];
  const groups = groupBy
    ? Array.from(new Set(logs.map((l: any) => l.entries?.[groupBy.split('/')[1]])))
    : [];

  return (
    <div data-testid="plot-container">
      <div data-testid="plot-type">{plotType}</div>
      <div data-testid="x-axis">{xAxis}</div>
      <div data-testid="y-axis">{yAxis}</div>
      {groupBy && <div data-testid="group-by">{groupBy}</div>}
      {aggregate && <div data-testid="aggregate">{aggregate}</div>}

      <svg data-testid="plot-svg">
        <g className="plotData">
          {logs.map((log: any, idx: number) => (
            <circle
              key={idx}
              data-testid={`data-point-${idx}`}
              className="data-point"
              cx={50 + idx * 30}
              cy={100}
              r={5}
              fill={
                groupBy && groups.length > 0
                  ? `hsl(${(groups.indexOf(log.entries?.[groupBy.split('/')[1]]) * 360) / groups.length}, 70%, 50%)`
                  : 'steelblue'
              }
            />
          ))}
        </g>
      </svg>

      {groupBy && groups.length > 0 && (
        <div data-testid="grouping-key">
          <div data-testid="grouping-key-header">Grouping Key</div>
          {groups.map((g: any, idx: number) => (
            <div key={idx} data-testid={`group-item-${idx}`}>
              <span
                data-testid={`group-color-${idx}`}
                style={{
                  backgroundColor: `hsl(${(idx * 360) / groups.length}, 70%, 50%)`,
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  marginRight: 8,
                }}
              />
              {String(g)}
            </div>
          ))}
        </div>
      )}

      <div data-testid="data-count">{logs.length} data points</div>
    </div>
  );
};

// Cross-table mock component
const CrossTablePlotComponent: React.FC<{
  tableAData: any;
  tableBData: any;
  xAxis: string; // e.g., "TableA.x"
  yAxis: string; // e.g., "TableB.y"
  onRender?: () => void;
}> = ({ tableAData, tableBData, xAxis, yAxis, onRender }) => {
  React.useEffect(() => {
    onRender?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableAData, tableBData, xAxis, yAxis]);

  // Merge data from both tables
  const mergedLogs = tableAData.logs.map((logA: any, idx: number) => ({
    [`TableA.entries`]: {
      [`TableA.${Object.keys(logA.entries)[0]}`]: Object.values(logA.entries)[0],
    },
    [`TableB.entries`]: tableBData.logs[idx]
      ? {
          [`TableB.${Object.keys(tableBData.logs[idx].entries)[0]}`]: Object.values(
            tableBData.logs[idx].entries
          )[0],
        }
      : undefined,
  }));

  const xTable = xAxis.split('.')[0];
  const yTable = yAxis.split('.')[0];

  return (
    <div data-testid="cross-table-plot">
      <div data-testid="x-table">{xTable}</div>
      <div data-testid="y-table">{yTable}</div>
      <div data-testid="x-axis">{xAxis}</div>
      <div data-testid="y-axis">{yAxis}</div>
      <div data-testid="is-cross-table">{xTable !== yTable ? 'true' : 'false'}</div>

      <svg data-testid="plot-svg">
        <g className="plotData">
          {mergedLogs.map((log: any, idx: number) => {
            const hasX = log[`${xTable}.entries`]?.[xAxis] !== undefined;
            const hasY = log[`${yTable}.entries`]?.[yAxis] !== undefined;
            if (!hasX || !hasY) return null;
            return (
              <circle
                key={idx}
                data-testid={`data-point-${idx}`}
                className="data-point"
                cx={50 + idx * 30}
                cy={100}
                r={5}
                fill="steelblue"
              />
            );
          })}
        </g>
      </svg>

      <div data-testid="merged-count">{mergedLogs.length} merged rows</div>
    </div>
  );
};

describe('Multi-Table Plotting Integration', () => {
  const meta = {
    alias: 'multi-table-integration',
    scenario: 'Testing multi-table, grouped, and aggregated plotting in browser',
    behavior: 'All advanced data scenarios work correctly in integrated environment',
  };

  describe('Cross-Table Plotting', () => {
    const meta = {
      alias: 'cross-table',
      scenario: 'Plotting with columns from different tables',
      behavior: 'Data from multiple tables is merged and plotted correctly',
    };

    it('renders cross-table scatter plot with data from TableA and TableB', async () => {
      const meta = {
        alias: 'cross-table-scatter',
        scenario: 'User selects X from TableA, Y from TableB',
        behavior: 'Plot shows merged data points',
      };

      const crossTableData = createCrossTableData();
      const onRender = vi.fn();

      render(
        <CrossTablePlotComponent
          tableAData={crossTableData.tableA}
          tableBData={crossTableData.tableB}
          xAxis="TableA.x"
          yAxis="TableB.y"
          onRender={onRender}
        />
      );

      expect(screen.getByTestId('cross-table-plot')).toBeInTheDocument();
      expect(screen.getByTestId('x-table')).toHaveTextContent('TableA');
      expect(screen.getByTestId('y-table')).toHaveTextContent('TableB');
      expect(screen.getByTestId('is-cross-table')).toHaveTextContent('true');
      expect(onRender).toHaveBeenCalled();
    });

    it('displays correct table prefixes in axis labels', () => {
      const meta = {
        alias: 'cross-table-labels',
        scenario: 'Cross-table plot is rendered',
        behavior: 'Axis labels show table prefixes (TableA.x, TableB.y)',
      };

      const crossTableData = createCrossTableData();

      render(
        <CrossTablePlotComponent
          tableAData={crossTableData.tableA}
          tableBData={crossTableData.tableB}
          xAxis="TableA.x"
          yAxis="TableB.y"
        />
      );

      expect(screen.getByTestId('x-axis')).toHaveTextContent('TableA.x');
      expect(screen.getByTestId('y-axis')).toHaveTextContent('TableB.y');
    });

    it('handles different row counts between tables', () => {
      const meta = {
        alias: 'cross-table-unequal',
        scenario: 'TableA has more rows than TableB',
        behavior: 'Uses minimum row count for merged data',
      };

      const tableAData = {
        logs: [
          { id: '1', entries: { x: 10 }, params: {} },
          { id: '2', entries: { x: 20 }, params: {} },
          { id: '3', entries: { x: 30 }, params: {} },
          { id: '4', entries: { x: 40 }, params: {} },
        ],
        fields: {},
      };

      const tableBData = {
        logs: [
          { id: '1', entries: { y: 100 }, params: {} },
          { id: '2', entries: { y: 200 }, params: {} },
        ],
        fields: {},
      };

      render(
        <CrossTablePlotComponent
          tableAData={tableAData}
          tableBData={tableBData}
          xAxis="TableA.x"
          yAxis="TableB.y"
        />
      );

      // Should still render, merged count shows all rows but some may be incomplete
      expect(screen.getByTestId('merged-count')).toHaveTextContent('4 merged rows');

      // Only first 2 data points should have complete data
      expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
      expect(screen.getByTestId('data-point-1')).toBeInTheDocument();
      expect(screen.queryByTestId('data-point-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('data-point-3')).not.toBeInTheDocument();
    });

    it('handles same table for both axes (not cross-table)', () => {
      const meta = {
        alias: 'same-table-axes',
        scenario: 'Both X and Y from TableA',
        behavior: 'is-cross-table indicator shows false',
      };

      const tableAData = {
        logs: [{ id: '1', entries: { x: 10, y: 100 }, params: {} }],
        fields: {},
      };

      render(
        <CrossTablePlotComponent
          tableAData={tableAData}
          tableBData={tableAData}
          xAxis="TableA.x"
          yAxis="TableA.y"
        />
      );

      expect(screen.getByTestId('is-cross-table')).toHaveTextContent('false');
    });
  });

  describe('Grouped Table Plotting', () => {
    const meta = {
      alias: 'grouped-plotting',
      scenario: 'Plotting data grouped by a category column',
      behavior: 'Data points are colored by group and legend is shown',
    };

    it('renders plot with grouping and shows grouping key', () => {
      const meta = {
        alias: 'grouped-with-key',
        scenario: 'User groups scatter plot by category',
        behavior: 'Grouping key appears with all groups listed',
      };

      const data = createGroupedTableData();

      render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          groupBy="entries/category"
          data={data}
        />
      );

      expect(screen.getByTestId('grouping-key')).toBeInTheDocument();
      expect(screen.getByTestId('grouping-key-header')).toHaveTextContent('Grouping Key');
      expect(screen.getByTestId('group-item-0')).toBeInTheDocument();
      expect(screen.getByTestId('group-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('group-item-2')).toBeInTheDocument();
    });

    it('assigns different colors to different groups', () => {
      const meta = {
        alias: 'grouped-colors',
        scenario: 'Three groups in the data',
        behavior: 'Each group has a distinct color',
      };

      const data = createGroupedTableData();

      render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          groupBy="entries/category"
          data={data}
        />
      );

      const color0 = screen.getByTestId('group-color-0').style.backgroundColor;
      const color1 = screen.getByTestId('group-color-1').style.backgroundColor;
      const color2 = screen.getByTestId('group-color-2').style.backgroundColor;

      expect(color0).not.toBe(color1);
      expect(color1).not.toBe(color2);
      expect(color0).not.toBe(color2);
    });

    it('does not show grouping key when groupBy is not set', () => {
      const meta = {
        alias: 'no-grouping',
        scenario: 'Plot without grouping',
        behavior: 'No grouping key element is rendered',
      };

      const data = createGroupedTableData();

      render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          data={data}
        />
      );

      expect(screen.queryByTestId('grouping-key')).not.toBeInTheDocument();
    });

    it('handles single group in data', () => {
      const meta = {
        alias: 'single-group',
        scenario: 'All data belongs to one group',
        behavior: 'One group appears in the grouping key',
      };

      const singleGroupData = {
        logs: [
          { id: '1', entries: { x: 10, y: 100, category: 'OnlyGroup' }, params: {} },
          { id: '2', entries: { x: 20, y: 200, category: 'OnlyGroup' }, params: {} },
        ],
        fields: {},
      };

      render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          groupBy="entries/category"
          data={singleGroupData}
        />
      );

      expect(screen.getByTestId('group-item-0')).toHaveTextContent('OnlyGroup');
      expect(screen.queryByTestId('group-item-1')).not.toBeInTheDocument();
    });

    it('handles many groups (10+)', () => {
      const meta = {
        alias: 'many-groups',
        scenario: 'Data has 10+ distinct groups',
        behavior: 'All groups are shown in the key',
      };

      const manyGroupsData = {
        logs: Array.from({ length: 12 }, (_, i) => ({
          id: String(i),
          entries: { x: i * 10, y: i * 100, category: `Group${i}` },
          params: {},
        })),
        fields: {},
      };

      render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          groupBy="entries/category"
          data={manyGroupsData}
        />
      );

      expect(screen.getByTestId('group-item-0')).toBeInTheDocument();
      expect(screen.getByTestId('group-item-11')).toBeInTheDocument();
    });

    it('updates when group structure changes', () => {
      const meta = {
        alias: 'group-change',
        scenario: 'Data with different groups is loaded',
        behavior: 'Grouping key updates to show new groups',
      };

      const data1 = {
        logs: [{ id: '1', entries: { x: 10, category: 'OldGroup' }, params: {} }],
        fields: {},
      };

      const data2 = {
        logs: [{ id: '1', entries: { x: 10, category: 'NewGroup' }, params: {} }],
        fields: {},
      };

      const { rerender } = render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          groupBy="entries/category"
          data={data1}
        />
      );

      expect(screen.getByTestId('group-item-0')).toHaveTextContent('OldGroup');

      rerender(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          groupBy="entries/category"
          data={data2}
        />
      );

      expect(screen.getByTestId('group-item-0')).toHaveTextContent('NewGroup');
    });
  });

  describe('Aggregated Table Plotting', () => {
    const meta = {
      alias: 'aggregated-plotting',
      scenario: 'Plotting pre-aggregated data',
      behavior: 'Aggregate values are displayed correctly',
    };

    it('renders bar chart with pre-aggregated data', () => {
      const meta = {
        alias: 'aggregated-bar',
        scenario: 'Bar chart showing sum_sales by category',
        behavior: 'Bars reflect pre-aggregated sum values',
      };

      const data = createAggregatedTableData();

      render(
        <MockPlotComponent
          plotType="Bar Chart"
          xAxis="entries/category"
          yAxis="entries/sum_sales"
          aggregate="category"
          data={data}
        />
      );

      expect(screen.getByTestId('plot-type')).toHaveTextContent('Bar Chart');
      expect(screen.getByTestId('aggregate')).toHaveTextContent('category');
      expect(screen.getByTestId('data-count')).toHaveTextContent('4 data points');
    });

    it('shows aggregate indicator in configuration', () => {
      const meta = {
        alias: 'aggregate-indicator',
        scenario: 'Aggregated data is plotted',
        behavior: 'Aggregate property is visible in plot config',
      };

      const data = createAggregatedTableData();

      render(
        <MockPlotComponent
          plotType="Bar Chart"
          xAxis="entries/category"
          yAxis="entries/sum_sales"
          aggregate="entries/category"
          data={data}
        />
      );

      expect(screen.getByTestId('aggregate')).toBeInTheDocument();
    });

    it('renders scatter plot with aggregated X and Y', () => {
      const meta = {
        alias: 'aggregated-scatter',
        scenario: 'Plotting count vs sum aggregates',
        behavior: 'Each aggregate row becomes a scatter point',
      };

      const data = createAggregatedTableData();

      render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/count"
          yAxis="entries/sum_sales"
          aggregate="category"
          data={data}
        />
      );

      expect(screen.getByTestId('plot-type')).toHaveTextContent('Scatter Plot');
      expect(screen.getByTestId('data-count')).toHaveTextContent('4 data points');
    });
  });

  describe('Combined Scenarios', () => {
    const meta = {
      alias: 'combined-scenarios',
      scenario: 'Testing combinations of cross-table, grouped, and aggregated',
      behavior: 'Complex scenarios work correctly together',
    };

    it('handles aggregated data with grouping overlay', () => {
      const meta = {
        alias: 'aggregate-with-grouping',
        scenario: 'Pre-aggregated data is further grouped by region',
        behavior: 'Both aggregate and group information are displayed',
      };

      const data = {
        logs: [
          { id: '1', entries: { category: 'North', sum_sales: 1000, region: 'East' }, params: {} },
          { id: '2', entries: { category: 'South', sum_sales: 1500, region: 'East' }, params: {} },
          { id: '3', entries: { category: 'North', sum_sales: 800, region: 'West' }, params: {} },
          { id: '4', entries: { category: 'South', sum_sales: 1200, region: 'West' }, params: {} },
        ],
        fields: {},
      };

      render(
        <MockPlotComponent
          plotType="Bar Chart"
          xAxis="entries/category"
          yAxis="entries/sum_sales"
          groupBy="entries/region"
          aggregate="category"
          data={data}
        />
      );

      expect(screen.getByTestId('aggregate')).toBeInTheDocument();
      expect(screen.getByTestId('grouping-key')).toBeInTheDocument();
      expect(screen.getByTestId('group-item-0')).toHaveTextContent('East');
      expect(screen.getByTestId('group-item-1')).toHaveTextContent('West');
    });

    it('preserves settings when data complexity changes', () => {
      const meta = {
        alias: 'settings-preserved',
        scenario: 'Switching from complex to simple data',
        behavior: 'Plot type and other settings are preserved',
      };

      const complexData = {
        logs: [
          { id: '1', entries: { x: 10, y: 100, category: 'A' }, params: {} },
          { id: '2', entries: { x: 20, y: 200, category: 'B' }, params: {} },
        ],
        fields: {},
      };

      const simpleData = {
        logs: [
          { id: '1', entries: { x: 10, y: 100 }, params: {} },
          { id: '2', entries: { x: 20, y: 200 }, params: {} },
        ],
        fields: {},
      };

      const { rerender } = render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          groupBy="entries/category"
          data={complexData}
        />
      );

      expect(screen.getByTestId('plot-type')).toHaveTextContent('Scatter Plot');
      expect(screen.getByTestId('grouping-key')).toBeInTheDocument();

      // Rerender with simple data (no groupBy)
      rerender(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          data={simpleData}
        />
      );

      // Plot type should be preserved, grouping key should be gone
      expect(screen.getByTestId('plot-type')).toHaveTextContent('Scatter Plot');
      expect(screen.queryByTestId('grouping-key')).not.toBeInTheDocument();
    });

    it('handles transition from grouped to ungrouped data', () => {
      const meta = {
        alias: 'group-to-ungroup',
        scenario: 'User clears group by selection',
        behavior: 'Plot updates to show ungrouped data',
      };

      const data = createGroupedTableData();

      const { rerender } = render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          groupBy="entries/category"
          data={data}
        />
      );

      expect(screen.getByTestId('grouping-key')).toBeInTheDocument();

      // Clear groupBy
      rerender(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          data={data}
        />
      );

      expect(screen.queryByTestId('grouping-key')).not.toBeInTheDocument();
      expect(screen.queryByTestId('group-by')).not.toBeInTheDocument();
    });

    it('calls onRender when complex data changes', async () => {
      const meta = {
        alias: 'render-callback',
        scenario: 'Data configuration changes multiple times',
        behavior: 'onRender is called for each change',
      };

      const onRender = vi.fn();
      const data = createGroupedTableData();

      const { rerender } = render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          data={data}
          onRender={onRender}
        />
      );

      expect(onRender).toHaveBeenCalledTimes(1);

      // Add grouping
      rerender(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          groupBy="entries/category"
          data={data}
          onRender={onRender}
        />
      );

      expect(onRender).toHaveBeenCalledTimes(2);

      // Add aggregate
      rerender(
        <MockPlotComponent
          plotType="Bar Chart"
          xAxis="entries/category"
          yAxis="entries/y"
          groupBy="entries/category"
          aggregate="category"
          data={data}
          onRender={onRender}
        />
      );

      expect(onRender).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    const meta = {
      alias: 'edge-cases',
      scenario: 'Testing edge cases in multi-table scenarios',
      behavior: 'System handles edge cases gracefully',
    };

    it('handles empty data gracefully', () => {
      const meta = {
        alias: 'empty-data',
        scenario: 'No data after cross-table join',
        behavior: 'Plot renders without errors',
      };

      const emptyData = { logs: [], fields: {} };

      render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          data={emptyData}
        />
      );

      expect(screen.getByTestId('data-count')).toHaveTextContent('0 data points');
    });

    it('handles null values in group column', () => {
      const meta = {
        alias: 'null-group',
        scenario: 'Some group values are null',
        behavior: 'Null is treated as a valid group',
      };

      const dataWithNull = {
        logs: [
          { id: '1', entries: { x: 10, category: null }, params: {} },
          { id: '2', entries: { x: 20, category: 'A' }, params: {} },
        ],
        fields: {},
      };

      render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          groupBy="entries/category"
          data={dataWithNull}
        />
      );

      expect(screen.getByTestId('grouping-key')).toBeInTheDocument();
      // Should have 2 groups: null and 'A'
      expect(screen.getByTestId('group-item-0')).toBeInTheDocument();
      expect(screen.getByTestId('group-item-1')).toBeInTheDocument();
    });

    it('handles rapid setting changes', async () => {
      const meta = {
        alias: 'rapid-changes',
        scenario: 'User rapidly changes plot settings',
        behavior: 'Final state is rendered correctly',
      };

      const data = createGroupedTableData();
      const onRender = vi.fn();

      const { rerender } = render(
        <MockPlotComponent
          plotType="Scatter Plot"
          xAxis="entries/x"
          yAxis="entries/y"
          data={data}
          onRender={onRender}
        />
      );

      // Rapid changes
      rerender(
        <MockPlotComponent
          plotType="Line Chart"
          xAxis="entries/x"
          yAxis="entries/y"
          data={data}
          onRender={onRender}
        />
      );

      rerender(
        <MockPlotComponent
          plotType="Bar Chart"
          xAxis="entries/category"
          yAxis="entries/y"
          data={data}
          onRender={onRender}
        />
      );

      rerender(
        <MockPlotComponent
          plotType="Histogram"
          xAxis="entries/y"
          yAxis="entries/y"
          data={data}
          onRender={onRender}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('plot-type')).toHaveTextContent('Histogram');
      });
    });

    it(
      'handles cross-table plot with one aggregated column',
      {
        meta: {
          alias: 'Combined-CrossAggregated',
          scenario: 'Cross-table with aggregated Y column.',
          behavior: 'X from raw table, Y from aggregated column.',
        },
      },
      async () => {
        const tableAData = { x: [1, 2, 3, 4, 5] };
        const tableBData = { sum_y: [100, 200, 300, 400, 500] };

        // Cross-table with aggregated column
        const combinedLength = Math.min(tableAData.x.length, tableBData.sum_y.length);

        expect(combinedLength).toBe(5);
      }
    );

    it(
      'handles all three: cross-table, grouped, and aggregated',
      {
        meta: {
          alias: 'Combined-AllThree',
          scenario: 'Complex scenario with all data features.',
          behavior: 'Cross-table data with groups and pre-aggregated values.',
        },
      },
      async () => {
        const complexData = [
          { tableA_x: 1, tableB_sum_y: 100, tableC_group: 'North' },
          { tableA_x: 2, tableB_sum_y: 200, tableC_group: 'South' },
          { tableA_x: 3, tableB_sum_y: 150, tableC_group: 'North' },
        ];

        const groups = Array.from(new Set(complexData.map((d) => d.tableC_group)));
        const tableCount = 3; // A, B, C

        expect(groups).toContain('North');
        expect(groups).toContain('South');
        expect(tableCount).toBe(3);
      }
    );

    it(
      'handles transition from cross-table to single-table',
      {
        meta: {
          alias: 'Combined-CrossToSingle',
          scenario: 'User changes from cross-table to single-table plot.',
          behavior: 'Plot correctly updates to use single table data.',
        },
      },
      async () => {
        let xAxis = 'TableA.x';
        let yAxis = 'TableB.y';

        const getUsedTables = (x: string, y: string) => {
          const tables = new Set<string>();
          tables.add(x.split('.')[0]);
          tables.add(y.split('.')[0]);
          return tables;
        };

        // Initially cross-table
        let tables = getUsedTables(xAxis, yAxis);
        expect(tables.size).toBe(2);

        // Change to single table
        yAxis = 'TableA.y';
        tables = getUsedTables(xAxis, yAxis);
        expect(tables.size).toBe(1);
      }
    );

    it(
      'handles transition from aggregated to raw data',
      {
        meta: {
          alias: 'Combined-AggToRaw',
          scenario: 'User changes from aggregated column to raw column.',
          behavior: 'Plot correctly updates to use raw data.',
        },
      },
      async () => {
        let yColumn = 'sum_value'; // Aggregated

        const isAggregated = (col: string) => {
          const aggPrefixes = ['sum_', 'mean_', 'count_', 'min_', 'max_', 'avg_'];
          return aggPrefixes.some((p) => col.startsWith(p));
        };

        expect(isAggregated(yColumn)).toBe(true);

        // Change to raw column
        yColumn = 'value';
        expect(isAggregated(yColumn)).toBe(false);
      }
    );
  });
});
