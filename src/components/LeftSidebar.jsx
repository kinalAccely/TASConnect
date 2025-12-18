import React from "react";
import LeftSidebarLight from "./light/LeftSidebar.jsx";
import LeftSidebarDark from "./dark/LeftSidebar.jsx";

export default function LeftSidebar(props) {
  const { theme = "light", ...rest } = props;

  if (theme === "dark") {
    return <LeftSidebarDark {...rest} theme="dark" />;
  }

  return <LeftSidebarLight {...rest} theme="light" />;
}
