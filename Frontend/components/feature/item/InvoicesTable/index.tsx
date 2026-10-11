import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TableRow = {
  invoice: string;
  status: string;
  method: string;
  amount: string;
};

interface InvoicesTableUIProps {
  translations: {
    tableCaption: string;
    tableHead: TableRow;
  };
  rows: TableRow[];
}

// This is the shared pure UI between all instances in the current dir
// ======== HIGHEST LEVEL COMPONENT WHICH NEEDS TO STAY PURE ========
// all XXX<ParentDirName>.tsx files (feature dir name + version prefix)
// are concrete and final instances and dependency injectors of this UI.
// All other modules are shared utils like common functionality hooks.
export default function InvoicesTableUI(props: InvoicesTableUIProps) {
  return (
    <Table>
      <TableCaption>{props.translations.tableCaption}</TableCaption>
      <Header translations={props.translations.tableHead} />
      <Body rows={props.rows} />
    </Table>
  );
}

// --------- Main UI Sub-components ---------

function Header({
  translations,
}: {
  translations: {
    invoice: string;
    status: string;
    method: string;
    amount: string;
  };
}) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-[100px]">{translations.invoice}</TableHead>
        <TableHead>{translations.status}</TableHead>
        <TableHead>{translations.method}</TableHead>
        <TableHead className="text-right">{translations.amount}</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function Body({ rows }: { rows: TableRow[] }) {
  return (
    <TableBody>
      {rows.map((row) => (
        <Row key={row.invoice} row={row} />
      ))}
    </TableBody>
  );
}

function Row({ row }: { row: TableRow }) {
  return (
    <TableRow key={row.invoice}>
      <TableCell className="font-medium">{row.invoice}</TableCell>
      <TableCell>{row.status}</TableCell>
      <TableCell>{row.method}</TableCell>
      <TableCell className="text-right">{row.amount}</TableCell>
    </TableRow>
  );
}
