"use client";

import { Table, TableHead, TableBody, TableCell, TableHeader, TableRow } from "@/components/UI/table";

export const EmptyTable = () => {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="bg-[#F5F4F4] text-center py-2">Logs</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow>
					<TableCell className="h-[21px] text-center text-gray-500 py-2 EmptyLogsTable">
						Select a project to display your logs.
					</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	);
};
