import { useEffect } from "react";
import ShadrApp from "@shadr/editor-react";

function App() {
  useEffect(() => {
    console.log("something");
  }, []);

  return (
    <>
      <ShadrApp />
    </>
  );
}

export default App;
