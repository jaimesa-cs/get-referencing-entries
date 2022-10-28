import { Button, EmptyState, Info, InstructionText, Tooltip } from "@contentstack/venus-components";

import ContentstackUIExtension from "@contentstack/ui-extensions-sdk";
import React from "react";

const Heading = () => {
  return <>Referenced In</>;
};
const Description = () => {
  return <></>;
};
interface IReference {
  content_type_title: string;
  content_type_uid: string;
  entry_uid: string;
  locale: string;
  title: string;
}
function App() {
  const [error, setError] = React.useState<any>(null);
  const [extension, setExtension] = React.useState<any>(null);
  const [references, setReferences] = React.useState<IReference[]>([]);
  const [postRobot, setPostRobot] = React.useState<any>(null);
  React.useEffect(() => {
    // eslint-disable-next-line no-restricted-globals
    // if (self === top) {
    //   const msg = "This extension can only be used in Contentstack";
    //   console.log("Extension loaded outside Contentstack!", msg);
    //   setError(msg);
    // } else {
    ContentstackUIExtension.init().then((extension: any) => {
      // console.log("Extension Loaded!", extension);
      // 'content_types/{{content_type_uid}}/entries/{{uid}}/references'
      console.log("extension.entry", extension.entry.getData().uid);
      extension.postRobot
        .sendToParent("stackQuery", {
          action: "getEntryReferences",
          content_type_uid: extension.entry.content_type.uid,
          uid: extension.entry.getData().uid,
        })
        .then((response: any) => {
          console.log("response", response);
          setReferences(response.data.references);
        })
        .catch((error: any) => {
          // console.log("error", error);
        });
    });
    // }
  }, []);

  return error ? (
    <EmptyState heading={<Heading />} description={<div>{error}</div>} />
  ) : (
    <div>
      <EmptyState heading={<Heading />} description={<Description />} />
      <div>
        {references.map((ref: IReference) => (
          <>
            <Tooltip
              content={`${ref.title}, ${ref.entry_uid} :: ${ref.content_type_title}`}
              position="top"
              type="primary"
            >
              <InstructionText>
                {ref.title} <strong>[{ref.entry_uid}]</strong>
              </InstructionText>
            </Tooltip>
            <hr />
          </>
        ))}
      </div>
    </div>
  );
}

export default App;
