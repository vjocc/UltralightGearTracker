import { LogoEmblem } from './LogoEmblem.jsx';
import { LogoText } from './LogoText.jsx';

// figma node: 1:28 MemoFox Logo (4 variants)
const __venc = (v) => String(v).replace(/[%|=]/g, encodeURIComponent);
const __vkey = (p) => "color=" + __venc(p.color) + '|' + "vertical=" + __venc(p.vertical);

export function MemoFoxLogo(_p = {}) {
  const props = { ..._p, color: _p.color ?? true, vertical: _p.vertical ?? true };
  const __body0 = () => (
    <div className={props.className} style={{
      width: "fit-content",
      display: "flex",
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style,
    }}>
      <div style={{
          position: "relative",
          width: 46,
          flexShrink: 0,
          alignSelf: "stretch",
          height: "auto",
        }}>{props.icon1 ?? <LogoEmblem color={true} />}</div>
      <LogoText
        style={{
          position: "relative",
          width: 103,
          height: 16,
          flexShrink: 0,
        }}
        color={true}
      />
    </div>
  );
  const __body1 = () => (
    <div className={props.className} style={{
      width: "fit-content",
      display: "flex",
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style,
    }}>
      <div style={{
          position: "relative",
          width: 46,
          flexShrink: 0,
          alignSelf: "stretch",
          height: "auto",
        }}>{props.icon1 ?? <LogoEmblem color={false} />}</div>
      <LogoText
        style={{
          position: "relative",
          width: 103,
          height: 16,
          flexShrink: 0,
        }}
        color={false}
      />
    </div>
  );
  const __body2 = () => (
    <div className={props.className} style={{
      width: "fit-content",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style,
    }}>
      <div style={{
          position: "relative",
          width: 46,
          height: 32,
          flexShrink: 0,
        }}>{props.icon1 ?? <LogoEmblem color={false} />}</div>
      <LogoText
        style={{
          position: "relative",
          height: 16,
          flexShrink: 0,
          alignSelf: "stretch",
          width: "auto",
        }}
        color={false}
      />
    </div>
  );
  const __body3 = () => (
    <div className={props.className} style={{
      width: "fit-content",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style,
    }}>
      <div style={{
          position: "relative",
          width: 46,
          height: 32,
          flexShrink: 0,
        }}>{props.icon1 ?? <LogoEmblem color={true} />}</div>
      <LogoText
        style={{
          position: "relative",
          height: 16,
          flexShrink: 0,
          alignSelf: "stretch",
          width: "auto",
        }}
        color={true}
      />
    </div>
  );
  const __impls = {
    // figma: color=true, vertical=false
    "color=true|vertical=false": __body0,
    // figma: color=false, vertical=false
    "color=false|vertical=false": __body1,
    // figma: color=false, vertical=true
    "color=false|vertical=true": __body2,
    // figma: color=true, vertical=true
    "color=true|vertical=true": __body3,
  };
  return (__impls[__vkey(props)] ?? __body3)();
}
export default MemoFoxLogo;
