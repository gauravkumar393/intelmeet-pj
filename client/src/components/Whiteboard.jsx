import React, { useRef, useState, useEffect } from 'react';
import { Trash2, Edit3, Eraser, Circle } from 'lucide-react';

const Whiteboard = ({ roomId, socket }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const [color, setColor] = useState('#6366f1'); // default indigo
  const [size, setSize] = useState(4);
  const [tool, setTool] = useState('draw'); // 'draw' or 'erase'

  const colors = [
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Green', value: '#10b981' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'White', value: '#ffffff' }
  ];

  // Set up canvas settings and resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set high resolution canvas drawing backing store
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;

    const handleResize = () => {
      // Create temporary canvas to hold current drawing
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);

      // Resize original canvas
      const newRect = canvas.getBoundingClientRect();
      canvas.width = newRect.width;
      canvas.height = newRect.height;

      // Restore configurations and draw image back
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Set up socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleRemoteDraw = (data) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) return;

      const rect = canvas.getBoundingClientRect();
      const x0 = data.x0 * rect.width;
      const y0 = data.y0 * rect.height;
      const x1 = data.x1 * rect.width;
      const y1 = data.y1 * rect.height;

      context.beginPath();
      context.moveTo(x0, y0);
      context.lineTo(x1, y1);
      context.strokeStyle = data.color;
      context.lineWidth = data.size;
      context.stroke();
      context.closePath();
    };

    const handleRemoteClear = () => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
    };

    socket.on('whiteboard-draw', handleRemoteDraw);
    socket.on('whiteboard-clear', handleRemoteClear);

    return () => {
      socket.off('whiteboard-draw', handleRemoteDraw);
      socket.off('whiteboard-clear', handleRemoteClear);
    };
  }, [socket]);

  // Drawing mouse handlers
  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Support mouse or touch triggers
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    const pos = getMousePos(e);
    lastPosRef.current = pos;
    isDrawingRef.current = true;
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    const rect = canvas.getBoundingClientRect();
    const currentPos = getMousePos(e);

    const activeColor = tool === 'erase' ? '#0f172a' : color; // erase draws canvas bg color
    const activeSize = tool === 'erase' ? size * 4 : size; // erasers are wider

    // Draw locally
    context.beginPath();
    context.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    context.lineTo(currentPos.x, currentPos.y);
    context.strokeStyle = activeColor;
    context.lineWidth = activeSize;
    context.stroke();
    context.closePath();

    // Emit drawing normalized ratios
    if (socket) {
      socket.emit('whiteboard-draw', {
        roomID: roomId,
        x0: lastPosRef.current.x / rect.width,
        y0: lastPosRef.current.y / rect.height,
        x1: currentPos.x / rect.width,
        y1: currentPos.y / rect.height,
        color: activeColor,
        size: activeSize
      });
    }

    lastPosRef.current = currentPos;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    // Clear local screen
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Emit clear to room peers
    if (socket) {
      socket.emit('whiteboard-clear', { roomID: roomId });
    }
  };

  return (
    <div className="whiteboard-container">
      {/* Toolbar overlay */}
      <div className="whiteboard-toolbar">
        {/* Colors group */}
        <div className="whiteboard-tool-group">
          {colors.map((c) => (
            <button
              key={c.value}
              className={`whiteboard-color-btn ${color === c.value && tool === 'draw' ? 'active' : ''}`}
              style={{ backgroundColor: c.value }}
              title={c.name}
              onClick={() => {
                setColor(c.value);
                setTool('draw');
              }}
            />
          ))}
        </div>

        {/* Brush config & Clear button */}
        <div className="whiteboard-tool-group">
          <button
            className={`btn ${tool === 'draw' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            title="Brush Tool"
            onClick={() => setTool('draw')}
          >
            <Edit3 size={14} />
          </button>
          
          <button
            className={`btn ${tool === 'erase' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            title="Eraser Tool"
            onClick={() => setTool('erase')}
          >
            <Eraser size={14} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Size:</span>
            <input
              type="range"
              min="2"
              max="20"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="whiteboard-size-slider"
            />
          </div>

          <button
            className="btn btn-danger"
            style={{ padding: '6px 12px', fontSize: '0.8rem', marginLeft: '12px' }}
            onClick={handleClear}
            title="Clear canvas"
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="whiteboard-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="whiteboard-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
};

export default Whiteboard;
