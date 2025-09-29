"use client";

import { Table, TableHead, TableBody, TableCell, TableHeader, TableRow } from "@/components/UI/table";

export const EmptyTable = () => {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="bg-[#F5F4F4] text-center py-2 text-label">Logs</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow>
					<TableCell className="h-[21px] text-center text-muted-foreground py-2 EmptyLogsTable text-body-sm">
						Select a project to display your logs.
					</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	);
};
