// figma node: 1:42 Buttons / CTA
export function ButtonsCTA(_p = {}) {
  const props = { ..._p, label: _p.label ?? "Button" };
  return (
    <div className={props.className} style={{
      width: "fit-content",
      borderRadius: 100,
      backgroundColor: "rgb(255,215,0)",
      display: "flex",
      flexDirection: "row",
      padding: "12px 36px 12px 36px",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style,
    }}>
      <span style={{
        position: "relative",
        fontFamily: "\"Plus Jakarta Sans\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: 700,
        fontSize: 16,
        whiteSpace: "nowrap",
        lineHeight: "24px",
        color: "rgb(26,21,18)",
        flexShrink: 0,
        alignSelf: "stretch",
      }}>{props.label}</span>
    </div>
  );
}
export default ButtonsCTA;
