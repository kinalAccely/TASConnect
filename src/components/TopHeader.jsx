import React from "react";
import TopHeaderLight from "./light/TopHeader.jsx";
import TopHeaderDark from "./dark/TopHeader.jsx";

export default function TopHeader(props) {
  const { theme = "light", ...rest } = props;

  if (theme === "dark") {
    return <TopHeaderDark {...rest} theme="dark" />;
  }

  return <TopHeaderLight {...rest} theme="light" />;
}
