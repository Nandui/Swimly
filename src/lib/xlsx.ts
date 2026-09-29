import "server-only";
import readXlsxFile from "read-excel-file/universal";

/** An uploaded Excel workbook as sheets of rows. The in-memory reader copes
 *  with the streamed zip layout Legend and the payroll system write, which
 *  the file-stream reader rejects. */
export async function readWorkbook(file: File) {
  return readXlsxFile(await file.arrayBuffer());
}
