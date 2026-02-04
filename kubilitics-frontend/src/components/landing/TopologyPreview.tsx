import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';

interface Node {
  id: string;
  type: string;
  label: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string | Node;
  target: string | Node;
}

const demoNodes: Node[] = [
  { id: 'ingress', type: 'ingress', label: 'Ingress' },
  { id: 'service-api', type: 'service', label: 'API Service' },
  { id: 'service-web', type: 'service', label: 'Web Service' },
  { id: 'deployment-api', type: 'deployment', label: 'API' },
  { id: 'deployment-web', type: 'deployment', label: 'Frontend' },
  { id: 'pod-api-1', type: 'pod', label: 'Pod' },
  { id: 'pod-api-2', type: 'pod', label: 'Pod' },
  { id: 'pod-web-1', type: 'pod', label: 'Pod' },
  { id: 'configmap', type: 'configmap', label: 'Config' },
  { id: 'secret', type: 'secret', label: 'Secret' },
];

const demoLinks: Link[] = [
  { source: 'ingress', target: 'service-api' },
  { source: 'ingress', target: 'service-web' },
  { source: 'service-api', target: 'deployment-api' },
  { source: 'service-web', target: 'deployment-web' },
  { source: 'deployment-api', target: 'pod-api-1' },
  { source: 'deployment-api', target: 'pod-api-2' },
  { source: 'deployment-web', target: 'pod-web-1' },
  { source: 'pod-api-1', target: 'configmap' },
  { source: 'pod-api-2', target: 'secret' },
];

const nodeColors: Record<string, string> = {
  ingress: 'hsl(174, 72%, 40%)',
  service: 'hsl(142, 76%, 36%)',
  deployment: 'hsl(25, 95%, 53%)',
  pod: 'hsl(199, 89%, 48%)',
  configmap: 'hsl(47, 96%, 53%)',
  secret: 'hsl(340, 82%, 52%)',
};

const nodeRadius: Record<string, number> = {
  ingress: 28,
  service: 26,
  deployment: 28,
  pod: 20,
  configmap: 18,
  secret: 18,
};

export function TopologyPreview() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const nodes = useMemo(() => demoNodes.map(n => ({ ...n })), []);
  const links = useMemo(() => demoLinks.map(l => ({ ...l })), []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = 500;
    const height = 350;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create gradient for glow effect
    const defs = svg.append('defs');
    
    // Glow filter
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Create force simulation
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links)
        .id((d: any) => d.id)
        .distance(80)
        .strength(0.3)
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius((d: any) => nodeRadius[d.type] + 15));

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', 'hsl(var(--muted-foreground))')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1.5);

    // Create animated particles on links
    const particles = g.append('g').attr('class', 'particles');
    
    links.forEach((_, i) => {
      particles.append('circle')
        .attr('class', `particle-${i}`)
        .attr('r', 2.5)
        .attr('fill', 'hsl(var(--primary))')
        .attr('opacity', 0.8);
    });

    // Create node groups
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer');

    // Add glow circles
    node.append('circle')
      .attr('r', (d: any) => nodeRadius[d.type] + 4)
      .attr('fill', (d: any) => nodeColors[d.type])
      .attr('opacity', 0.15)
      .attr('filter', 'url(#glow)');

    // Add main circles
    node.append('circle')
      .attr('r', (d: any) => nodeRadius[d.type])
      .attr('fill', (d: any) => nodeColors[d.type])
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    // Add status indicator
    node.append('circle')
      .attr('r', 5)
      .attr('cx', (d: any) => nodeRadius[d.type] * 0.6)
      .attr('cy', (d: any) => -nodeRadius[d.type] * 0.6)
      .attr('fill', 'hsl(142, 76%, 36%)')
      .attr('stroke', 'white')
      .attr('stroke-width', 1.5);

    // Add labels
    node.append('text')
      .attr('y', (d: any) => nodeRadius[d.type] + 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-weight', 500)
      .attr('fill', 'hsl(var(--muted-foreground))')
      .text((d: any) => d.label);

    // Add icons (letters)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', (d: any) => nodeRadius[d.type] * 0.6)
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .text((d: any) => d.type.charAt(0).toUpperCase());

    // Animation loop for particles
    let animationFrame: number;
    const animateParticles = () => {
      const time = Date.now();
      
      links.forEach((linkData, i) => {
        const source = linkData.source as Node;
        const target = linkData.target as Node;
        
        if (!source.x || !source.y || !target.x || !target.y) return;
        
        const t = ((time * 0.001 + i * 0.3) % 1);
        const x = source.x + (target.x - source.x) * t;
        const y = source.y + (target.y - source.y) * t;
        
        particles.select(`.particle-${i}`)
          .attr('cx', x)
          .attr('cy', y);
      });
      
      animationFrame = requestAnimationFrame(animateParticles);
    };

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Start particle animation
    animateParticles();

    // Add gentle floating animation
    const floatAnimation = () => {
      nodes.forEach((n, i) => {
        const time = Date.now() * 0.001;
        const offsetX = Math.sin(time + i) * 2;
        const offsetY = Math.cos(time + i * 1.3) * 2;
        n.fx = (n.x || 0) + offsetX;
        n.fy = (n.y || 0) + offsetY;
      });
      simulation.alpha(0.01).restart();
    };

    // Add slight continuous motion after initial settle
    const motionInterval = setInterval(() => {
      simulation.alpha(0.1).restart();
    }, 3000);

    return () => {
      simulation.stop();
      cancelAnimationFrame(animationFrame);
      clearInterval(motionInterval);
    };
  }, [nodes, links]);

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-2xl"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-error/80" />
            <div className="w-3 h-3 rounded-full bg-warning/80" />
            <div className="w-3 h-3 rounded-full bg-success/80" />
          </div>
          <span className="text-xs text-muted-foreground ml-2">Live Topology Preview</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Live
          </span>
        </div>
      </div>
      
      <svg
        ref={svgRef}
        viewBox="0 0 500 350"
        className="w-full h-auto"
        style={{ maxHeight: '350px' }}
      />
      
      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
        {Object.entries(nodeColors).slice(0, 4).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full border border-border/50">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{type}</span>
          </div>
        ))}
      </div>

      {/* Stats overlay */}
      <div className="absolute bottom-3 right-3 flex gap-2">
        <div className="text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full border border-border/50">
          10 nodes • 9 edges
        </div>
      </div>
    </div>
  );
}
