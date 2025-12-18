import React from "react";
import RightSidebarLight from "./light/RightSidebar.jsx";
import RightSidebarDark from "./dark/RightSidebar.jsx";

export default function RightSidebar(props) {
  const { theme = "light", ...rest } = props;

  if (theme === "dark") {
    return <RightSidebarDark {...rest} theme="dark" />;
  }

  return <RightSidebarLight {...rest} theme="light" />;
}
