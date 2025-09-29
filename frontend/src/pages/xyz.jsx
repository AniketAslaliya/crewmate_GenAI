import { useEffect, useRef } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";

const GraphVisualizer = ({ paragraph }) => {
  const graphRef = useRef(null);

  const generateGraphData = (text) => {
    const sentences = text.split(".");
    const nodes = [];
    const edges = [];
    let idCounter = 1;
    const conceptMap = {};

    sentences.forEach((sentence) => {
      const words = sentence
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .split(" ")
        .filter((w) => w.length > 3);
      let prevNodeId = null;
      words.forEach((word) => {
        const key = word.toLowerCase();
        if (!conceptMap[key]) {
          conceptMap[key] = idCounter;
          nodes.push({ id: idCounter, label: word });
          prevNodeId = idCounter;
          idCounter++;
        } else {
          const currId = conceptMap[key];
          if (prevNodeId && prevNodeId !== currId) {
            edges.push({ from: prevNodeId, to: currId });
          }
          prevNodeId = currId;
        }
      });
    });

    return { nodes, edges };
  };

  useEffect(() => {
    if (!graphRef.current) return;
    const { nodes, edges } = generateGraphData(paragraph);

    const data = {
      nodes: new DataSet(nodes),
      edges: new DataSet(edges),
    };

    const options = {
      nodes: { shape: "dot", size: 20 },
      edges: { arrows: { to: { enabled: true, scaleFactor: 0.5 } }, smooth: true },
      physics: { enabled: true },
      interaction: { hover: true, dragNodes: true, zoomView: true },
    };

    const network = new Network(graphRef.current, data, options);

    return () => network.destroy();
  }, [paragraph]);

  return <div ref={graphRef} style={{ width: "100%", height: "600px" }} />;
};

export default GraphVisualizer;
