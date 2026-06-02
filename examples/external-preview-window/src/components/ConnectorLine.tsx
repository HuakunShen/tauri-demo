import type { PreviewPlacementDirection } from "../lib/geometry";
import { getConnectorPath } from "../lib/connector-path";

type ConnectorLineProps = {
  direction: PreviewPlacementDirection;
};

export function ConnectorLine({ direction }: ConnectorLineProps) {
  const connector = getConnectorPath(direction);

  return (
    <svg
      className="connector"
      aria-hidden="true"
      viewBox={connector.viewBox}
    >
      <path d={connector.path} />
      <circle cx={connector.start.cx} cy={connector.start.cy} r="3.5" />
      <circle cx={connector.end.cx} cy={connector.end.cy} r="3.5" />
    </svg>
  );
}
