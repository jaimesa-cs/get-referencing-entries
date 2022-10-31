import "./index.css";

import { Button, EmptyState, InfiniteScrollTable, InstructionText } from "@contentstack/venus-components";

import { CSVLink } from "react-csv";
import ContentstackUIExtension from "@contentstack/ui-extensions-sdk";
import React from "react";

interface ClipboardCopyProps {
  copyText: string;
}

function ClipboardCopy(props: ClipboardCopyProps) {
  const [isCopied, setIsCopied] = React.useState(false);

  // This is the function we wrote earlier
  async function copyTextToClipboard(text: string) {
    if ("clipboard" in navigator) {
      return await navigator.clipboard.writeText(text);
    } else {
      return document.execCommand("copy", true, text);
    }
  }

  // onClick handler function for the copy button
  const handleCopyClick = () => {
    // Asynchronously call copyTextToClipboard
    copyTextToClipboard(props.copyText)
      .then(() => {
        // If successful, update the isCopied state value
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, 1500);
      })
      .catch((err) => {
        console.log(err);
      });
  };
  return (
    <Button icon="CopyWhite" onClick={handleCopyClick} className="cs-button" disabled={isCopied}>
      {isCopied ? "Copied" : "Copy"}
    </Button>
  );
}

interface HeadingProps {
  data?: IReference[];
  entry?: any;
}

const Heading = (props: HeadingProps) => {
  return <DownloadCSV data={props.data} entry={props.entry} />;
};

const DownloadCSV = (props: HeadingProps) => {
  console.log("props", props);
  const csvLink = React.useRef<CSVLink & HTMLAnchorElement & { link: HTMLAnchorElement }>(null);
  const theData = props.data || [];
  const refData = theData.map((ref: IReference) => {
    return [ref.title, ref.entry_uid, ref.content_type_title, ref.content_type_uid, ref.locale];
  });

  const csvData = [["Title", "Entry UID", "Content Type Title", "Content Type UID", "Locale"], ...refData];
  return (
    <>
      {props.entry ? (
        <div className="FieldLabel">
          {refData && refData.length > 0 ? (
            <>
              <CSVLink filename={`${props.entry.title}_references.csv`} data={csvData} className="hidden" ref={csvLink}>
                -
              </CSVLink>
              {/* <ClipboardCopy copyText={csvData.map((row) => row.join(",")).join("\n")} />
              &nbsp; */}
              <Button buttonType="secondary" onClick={() => csvLink?.current?.link.click()} className="cs-button">
                Download CSV
              </Button>
            </>
          ) : (
            <>No data</>
          )}
        </div>
      ) : (
        <div className="FieldLabel">Loading data...</div>
      )}
    </>
  );
};

interface IReference {
  uniqueKey: string;
  content_type_title: string;
  content_type_uid: string;
  entry_uid: string;
  locale: string;
  title: string;
  status: "loading" | "loaded" | "error";
}

const columns = [
  {
    Header: "Title",
    id: "title",
    accessor: (data: IReference) => {
      return (
        <div>
          <div className="content-title">{data.title}</div>
          <InstructionText> Content Type: {data.content_type_title} </InstructionText>
        </div>
      );
    },
    default: true,
  },
  // {
  //   id: "uniqueKey",
  //   Header: "Unique UID",
  //   accessor: "uniqueKey",
  //   default: false,
  // },
];

function App() {
  const [error, setError] = React.useState<any>(null);
  const [references, setReferences] = React.useState<IReference[]>([]);
  const [entry, setEntry] = React.useState<any>(null);
  let [itemStatusMap, updateItemStatusMap] = React.useState<any>({});
  React.useEffect(() => {
    // eslint-disable-next-line no-restricted-globals
    // if (self === top) {
    //   const msg = "This extension can only be used in Contentstack";
    //   console.log("Extension loaded outside Contentstack!", msg);
    //   setError(msg);
    // } else {
    ContentstackUIExtension.init().then((extension: any) => {
      console.log("Extension Loaded!", extension);
      // 'content_types/{{content_type_uid}}/entries/{{uid}}/references'

      extension.postRobot
        .sendToParent("stackQuery", {
          action: "getEntryReferences",
          content_type_uid: extension.entry.content_type.uid,
          uid: extension.entry.getData().uid,
        })
        .then((response: any) => {
          setReferences(() => {
            setEntry(() => {
              return extension.entry.getData();
            });
            let ism: any = {};
            const refs = response.data.references.map((ref: IReference, index: number) => {
              const r: IReference = {
                ...ref,
                status: "loaded",
                uniqueKey: `${index}`,
              };
              ism[index] = "loaded";

              return r;
            });
            updateItemStatusMap(ism);
            return refs;
          });
        })
        .catch((error: any) => {
          setError(error);
        });
    });
    // }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return error ? (
    <EmptyState heading={<Heading />} description={<div>{error}</div>} />
  ) : (
    <div>
      <EmptyState heading={<Heading data={references} entry={entry} />} description={<></>} />
      {/* <DownloadCSV data={references} entry={entry} /> */}

      <InfiniteScrollTable
        name={{ plural: "references", singular: "reference" }}
        hideColumns={["uniqueKey"]}
        data={references}
        columns={columns}
        fetchTableData={() => {}}
        loadMoreItems={() => {}}
        columnSelector={false}
        emptyHeading={"No references found"}
        viewSelector={false}
        uniqueKey="uniqueKey"
        itemStatusMap={itemStatusMap}
        totalCounts={references.length}
      ></InfiniteScrollTable>
      {/* <div>
        {references.map((ref: IReference) => (
          <>
            <Tooltip
              content={`${ref.title}, ${ref.entry_uid} :: ${ref.content_type_title}`}
              position="top"
              type="primary"
            >
              <InstructionText>{ref.title}</InstructionText>
            </Tooltip>
            <hr />
          </>
        ))}
      </div> */}
    </div>
  );
}

export default App;
