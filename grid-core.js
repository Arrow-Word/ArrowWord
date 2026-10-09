// grid-core.js — v30
// ══════════════════════════════════════════════════════════════════════════════
// The ONE shared copy of the code that draws an Arrow Word puzzle grid.
// It was moved here, unchanged in behaviour, from builder.html — the builder is
// the master copy. Pages call it through the "ArrowGrid" object.
// Change how the grid is DRAWN here, not in the pages. Needs grid-core.css.
//
// v30 - Now used by solver.html as well as builder.html.
//       Clue text and answer letters use the Arimo font, which is shipped with
//       the site (arimo-bold.woff2), so every device draws them the same way.
//       The print layout moved here too: one print routine for both pages.
//       Removed the old "shrink text to fit" step, which never did anything.
// v29 - First version. Used by builder.html.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Font ────────────────────────────────────────────────────────────────────
  // The grid's text font. Arimo has the same letter widths as Arial; it is
  // loaded from the site itself (see grid-core.css), so phones and tablets that
  // have no Arial still wrap clue text exactly as the builder's screen does.
  const GRID_FONT='Arimo,Arial,sans-serif';
  // Start fetching the font straight away, and let pages wait for it if needed.
  const fontReady=(document.fonts&&document.fonts.load)
    ?document.fonts.load('600 16px Arimo').then(()=>true,()=>false)
    :Promise.resolve(false);

  // ── Arrow SVG ───────────────────────────────────────────────────────────────
  function arrowSVG(dir, s) {
    const c=s/2, m=Math.ceil(s*0.12), e=s-m;
    const sw=Math.max(1.6, s/12);
    const ahLarge=s*0.34, ahSmall=s*0.25;
    function head(x,y,dx,dy,size='large'){
      const ah = size === 'small' ? ahSmall : ahLarge;
      const l=Math.sqrt(dx*dx+dy*dy),nx=dx/l,ny=dy/l,px=-ny,py=nx;
      return `M${x-nx*ah+px*ah*0.45},${y-ny*ah+py*ah*0.45} L${x},${y} L${x-nx*ah-px*ah*0.45},${y-ny*ah-py*ah*0.45}`;
    }
    const paths={
      right:    [`M${m},${c} L${e},${c}`,          head(e,c,1,0,'large')],
      left:     [`M${e},${c} L${m},${c}`,          head(m,c,-1,0,'large')],
      down:     [`M${c},${m} L${c},${e}`,          head(c,e,0,1,'large')],
      up:       [`M${c},${e} L${c},${m}`,          head(c,m,0,-1,'large')],
      'right-down': [`M${m},${c} L${c},${c} L${c},${1.2*e-0.2*c}`, head(c,1.2*e-0.2*c,0,1,'small')],
      'down-right': [`M${c},${m} L${c},${c} L${1.2*e-0.2*c},${c}`, head(1.2*e-0.2*c,c,1,0,'small')],
      'left-down':  [`M${e},${c} L${c},${c} L${c},${1.2*e-0.2*c}`, head(c,1.2*e-0.2*c,0,1,'small')],
      'down-left':  [`M${c},${m} L${c},${c} L${1.2*m-0.2*c},${c}`, head(1.2*m-0.2*c,c,-1,0,'small')],
      'right-up':   [`M${m},${c} L${c},${c} L${c},${1.2*m-0.2*c}`, head(c,1.2*m-0.2*c,0,-1,'small')],
      'up-right':   [`M${c},${e} L${c},${c} L${1.2*e-0.2*c},${c}`, head(1.2*e-0.2*c,c,1,0,'small')],
      'left-up':    [`M${e},${c} L${c},${c} L${c},${1.2*m-0.2*c}`, head(c,1.2*m-0.2*c,0,-1,'small')],
      'up-left':    [`M${c},${e} L${c},${c} L${1.2*m-0.2*c},${c}`, head(1.2*m-0.2*c,c,-1,0,'small')],
    };
    const [p,a]=paths[dir]||paths.right;
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg"><path d="${p}" stroke="#7744bb" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${a}" stroke="#7744bb" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // The small, thin arrow drawn inside the first answer square of a word.
  function answerArrowSVG(dir,s,color='#7744bb'){
    const thinStroke=Math.max(1,s/16);
    return arrowSVG(dir,s)
      .replace(/stroke-width="[^"]+"/g,`stroke-width="${thinStroke}"`)
      .replaceAll('#7744bb',color);
  }

  // ── Word placement ──────────────────────────────────────────────────────────
  // Convention: letters are placed in natural reading order
  // (left-to-right for horizontal words, top-to-bottom for vertical words)
  function getWordCells(dir,ans,or,oc){
    const len=ans.length, cells=[];
    if(dir==='right')     {for(let i=0;i<len;i++)cells.push([or,oc+1+i]);}
    else if(dir==='left') {for(let i=0;i<len;i++)cells.push([or,oc-len+i]);}
    else if(dir==='down') {for(let i=0;i<len;i++)cells.push([or+1+i,oc]);}
    else if(dir==='up')   {for(let i=0;i<len;i++)cells.push([or-len+i,oc]);}
    else if(dir==='right-down'){cells.push([or,oc+1]);for(let i=1;i<len;i++)cells.push([or+i,oc+1]);}
    else if(dir==='down-right'){cells.push([or+1,oc]);for(let i=1;i<len;i++)cells.push([or+1,oc+i]);}
    else if(dir==='left-down') {cells.push([or,oc-1]);for(let i=1;i<len;i++)cells.push([or+i,oc-1]);}
    else if(dir==='down-left') {const t=[[or+1,oc]];for(let i=1;i<len;i++)t.push([or+1,oc-i]);t.sort((a,b)=>a[1]-b[1]);cells.push(...t);}
    else if(dir==='right-up')  {const t=[[or,oc+1]];for(let i=1;i<len;i++)t.push([or-i,oc+1]);t.sort((a,b)=>a[0]-b[0]);cells.push(...t);}
    else if(dir==='up-right')  {const t=[[or-1,oc]];for(let i=1;i<len;i++)t.push([or-1,oc+i]);cells.push(...t);}
    else if(dir==='left-up')   {const t=[[or,oc-1]];for(let i=1;i<len;i++)t.push([or-i,oc-1]);t.sort((a,b)=>a[0]-b[0]);cells.push(...t);}
    else if(dir==='up-left')   {const t=[[or-1,oc]];for(let i=1;i<len;i++)t.push([or-1,oc-i]);t.sort((a,b)=>a[1]-b[1]);cells.push(...t);}
    return cells;
  }

  // The first answer square of a word, and which edge its arrow sits on.
  function firstAnswerTarget(dir,or,oc){
    const steps={
      right:[0,1,'left'],left:[0,-1,'right'],down:[1,0,'top'],up:[-1,0,'bottom'],
      'right-down':[0,1,'left'],'down-right':[1,0,'top'],
      'left-down':[0,-1,'right'],'down-left':[1,0,'top'],
      'right-up':[0,1,'left'],'up-right':[-1,0,'bottom'],
      'left-up':[0,-1,'right'],'up-left':[-1,0,'bottom']
    };
    const [dr,dc,edge]=steps[dir]||steps.right;
    return {r:or+dr,c:oc+dc,edge};
  }

  // How much of a shared clue square each clue gets (longer text = more room).
  function clueBoxWeight(cl){
    const length=Math.max(1,String(cl&&cl.clue||'?').trim().length);
    return Math.sqrt(length);
  }

  function getAnswerArrowMarkers(r,c,grid){
    const markers=[];
    for(let or=0;or<grid.length;or++){
      for(let oc=0;oc<(grid[or]||[]).length;oc++){
        const owner=grid[or][oc];
        if(owner.t!=='clue'||!Array.isArray(owner.clues)||!owner.clues.length)continue;
        const weights=owner.clues.map(clueBoxWeight);
        const total=weights.reduce((sum,value)=>sum+value,0)||owner.clues.length;
        let consumed=0;
        owner.clues.forEach((cl,index)=>{
          const weight=weights[index]||1;
          const target=firstAnswerTarget(cl.dir,or,oc);
          if(target.r===r&&target.c===c){
            // Up/down arrows sit on horizontal cell edges, so center them across
            // the destination cell. Only left/right arrows follow the clue's
            // vertical share within a split clue box.
            const position=(target.edge==='top'||target.edge==='bottom')
              ?50
              :((consumed+weight/2)/total)*100;
            markers.push({dir:cl.dir,edge:target.edge,position});
          }
          consumed+=weight;
        });
      }
    }
    return markers;
  }

  function appendAnswerArrowMarkers(td,r,c,grid,cellPx,color='#7744bb'){
    const markerSize=Math.max(8,Math.round(cellPx*0.25));
    getAnswerArrowMarkers(r,c,grid).forEach(marker=>{
      const el=document.createElement('span');
      el.className='answer-arrow-marker edge-'+marker.edge;
      el.style.setProperty('--arrow-size',markerSize+'px');
      el.style.setProperty('--slot-position',marker.position+'%');
      el.innerHTML=answerArrowSVG(marker.dir,markerSize,color);
      td.appendChild(el);
    });
  }

  // ── Grid model ──────────────────────────────────────────────────────────────
  // Turns saved puzzle data into the grid of squares that gets drawn.
  function freshCell(){return{t:'empty',clues:[],answerOf:null};}

  function gridFromData(data){
    const R=data.rows,C=data.cols,G=[];
    for(let r=0;r<R;r++){G.push([]);for(let c=0;c<C;c++)G[r].push(freshCell());}
    (data.cells||[]).forEach(cell=>{
      if(cell.t==='black'){G[cell.r][cell.c].t='black';}
      else if(cell.t==='clue'){
        G[cell.r][cell.c]={t:'clue',clues:[],answerOf:null};
        cell.clues.forEach(cl=>{
          const clObj={clue:cl.clue,ans:cl.ans,dir:cl.dir,textSize:cl.textSize||0};
          G[cell.r][cell.c].clues.push(clObj);
          getWordCells(cl.dir,cl.ans,cell.r,cell.c).forEach(([ar,ac],i)=>{
            if(ar>=0&&ar<R&&ac>=0&&ac<C){
              const ex=G[ar][ac];
              if(ex.t==='answer'&&ex.answerOf)ex.answerOf2={or:cell.r,oc:cell.c,cl:clObj,letter:cl.ans[i]};
              else G[ar][ac]={t:'answer',clues:[],answerOf:{or:cell.r,oc:cell.c,cl:clObj,letter:cl.ans[i]}};
            }
          });
        });
      }
    });
    return G;
  }

  // ── Drawing one square ──────────────────────────────────────────────────────
  // o.grid, o.r, o.c      which square
  // o.cellSizePx          square size
  // o.textSizePx          the puzzle's default clue text size
  // o.solve               true = answer squares are typing boxes (solving);
  //                       false = answer squares show their letter (designing)
  // The page adds its own click and typing behaviour to the square afterwards.
  function buildCell(o){
    const r=o.r,c=o.c,cellSizePx=o.cellSizePx,textSizePx=o.textSizePx,solve=!!o.solve;
    const td=document.createElement('td');
    td.dataset.r=r;td.dataset.c=c;
    td.style.width=cellSizePx+'px';
    td.style.height=cellSizePx+'px';
    td.style.minWidth=cellSizePx+'px';
    td.style.minHeight=cellSizePx+'px';
    td.style.maxWidth=cellSizePx+'px';
    td.style.maxHeight=cellSizePx+'px';
    const cell=o.grid[r][c];

    if(cell.t==='black'){
      td.className='t-black';

    } else if(cell.t==='clue'){
      td.className='t-clue';
      const inner=document.createElement('div');inner.className='clue-inner';
      cell.clues.forEach((cl,idx)=>{
        if(idx>0){const dv=document.createElement('div');dv.className='clue-divider';inner.appendChild(dv);}
        const slot=document.createElement('div');
        slot.className='clue-slot';
        const fs=cl.textSize&&cl.textSize>0?cl.textSize:textSizePx;
        // Give longer clue text a larger share of the cell. Keep this independent
        // of fs so auto-fitting its font cannot make its own box smaller.
        slot.style.flex=clueBoxWeight(cl)+' 1 0';
        const txtDiv=document.createElement('div');txtDiv.className='slot-text';
        txtDiv.style.fontSize=fs+'px';
        txtDiv.textContent=cl.clue||'?';
        slot.appendChild(txtDiv);
        if(solve)slot.dataset.clueIdx=idx;
        inner.appendChild(slot);
      });
      td.appendChild(inner);

    } else if(cell.t==='answer'){
      td.className='t-answer';
      if(solve){
        const inp=document.createElement('input');
        inp.className='solve-input';inp.type='text';inp.maxLength=1;
        inp.style.fontSize=Math.round(cellSizePx*0.38)+'px';
        inp.dataset.r=r;inp.dataset.c=c;
        td.appendChild(inp);
      } else {
        const sp=document.createElement('span');sp.className='ans-letter';
        sp.style.fontSize=Math.round(cellSizePx*0.38)+'px';
        sp.textContent=cell.answerOf?cell.answerOf.letter:'';
        td.appendChild(sp);
      }
      appendAnswerArrowMarkers(td,r,c,o.grid,cellSizePx,o.arrowColor||'#7744bb');
    } else {
      td.className='t-empty';
    }
    return td;
  }

  // ── Printing ────────────────────────────────────────────────────────────────
  // Reads how a clue is laid out on screen (its lines and size) so the printout
  // can repeat the same line breaks. "table" is the on-screen grid.
  function getRenderedClueLayout(table,r,c,index){
    const cell=table&&table.querySelector('td[data-r="'+r+'"][data-c="'+c+'"]');
    const slot=cell&&cell.querySelectorAll('.clue-slot')[index];
    const text=slot&&slot.querySelector('.slot-text');
    if(!text||!text.clientWidth||!text.clientHeight)return null;
    const node=text.firstChild;
    const lines=[];
    if(node&&node.nodeType===Node.TEXT_NODE&&node.data.length){
      let line='',lastTop=null;
      for(let i=0;i<node.data.length;i++){
        const range=document.createRange();
        range.setStart(node,i);
        range.setEnd(node,i+1);
        const rect=range.getBoundingClientRect();
        if(rect.height>0&&lastTop!==null&&Math.abs(rect.top-lastTop)>1.5){
          lines.push(line.trim());
          line='';
          lastTop=rect.top;
        }else if(rect.height>0&&lastTop===null){
          lastTop=rect.top;
        }
        line+=node.data[i];
      }
      if(line.length)lines.push(line.trim());
    }
    return{
      fontSize:parseFloat(getComputedStyle(text).fontSize)||0,
      width:text.clientWidth,
      height:text.clientHeight,
      lines:lines.filter(Boolean)
    };
  }

  // Prints the puzzle on A4.
  // o.grid, o.rows, o.cols, o.cellSizePx, o.textSizePx   the puzzle
  // o.title          heading on each page
  // o.answerPage     true = an answers page first, then the blank puzzle
  //                  false = the blank puzzle only
  // o.screenTable    the on-screen grid, so the print repeats its line breaks
  function printPuzzle(o){
    const G=o.grid,R=o.rows,C=o.cols,cellSizePx=o.cellSizePx,textSizePx=o.textSizePx;
    if(!G||!G.length||!R||!C){alert('There is no puzzle grid to print yet.');return;}

    const pages=document.getElementById('ag-print-pages')||document.body.appendChild(document.createElement('div'));
    pages.id='ag-print-pages';
    pages.replaceChildren();
    const pageName=String(o.title||'').trim()||'Untitled puzzle';
    const availableWidth=(210-24)/25.4*96;
    const availableHeight=(297-24-18)/25.4*96;
    const printCellSize=Math.min(84,availableWidth/C,availableHeight/R);
    const scale=printCellSize/cellSizePx;
    const svgNS='http://www.w3.org/2000/svg';
    const htmlNS='http://www.w3.org/1999/xhtml';

    function svgNode(name,attrs){
      const node=document.createElementNS(svgNS,name);
      Object.keys(attrs||{}).forEach(key=>node.setAttribute(key,attrs[key]));
      return node;
    }

    function buildPrintGrid(showAnswers){
      const width=C*printCellSize,height=R*printCellSize;
      const svg=svgNode('svg',{
        class:'print-svg',xmlns:svgNS,
        width:width+'px',height:height+'px',
        viewBox:'0 0 '+width+' '+height,
        role:'img','aria-label':showAnswers?'Puzzle answer grid':'Blank puzzle grid'
      });
      svg.style.width=width+'px';
      svg.style.height=height+'px';
      svg.style.printColorAdjust='exact';
      svg.style.webkitPrintColorAdjust='exact';

      for(let r=0;r<R;r++){
        for(let c=0;c<C;c++){
          const cell=G[r][c]||freshCell();
          const x=c*printCellSize,y=r*printCellSize;
          const fill=cell.t==='black'?'#222':cell.t==='clue'?'#eee9f2':'#fff';
          svg.appendChild(svgNode('rect',{
            x:x,y:y,width:printCellSize,height:printCellSize,fill:fill
          }));

          if(cell.t==='answer'&&showAnswers&&cell.answerOf&&cell.answerOf.letter){
            const letter=svgNode('text',{
              x:x+printCellSize/2,y:y+printCellSize/2,
              'text-anchor':'middle','dominant-baseline':'central',
              'font-family':GRID_FONT,'font-size':Math.round(cellSizePx*.38)*scale,
              'font-weight':'600',fill:'#111'
            });
            letter.textContent=cell.answerOf.letter;
            svg.appendChild(letter);
          }

          if(cell.t==='answer'){
            const markerSize=Math.max(6,printCellSize*0.25);
            getAnswerArrowMarkers(r,c,G).forEach(marker=>{
              let markerX=x+printCellSize/2-markerSize/2;
              let markerY=y+printCellSize/2-markerSize/2;
              if(marker.edge==='left'){
                markerX=x+1.5*scale;
                markerY=y+printCellSize*marker.position/100-markerSize/2;
              }else if(marker.edge==='right'){
                markerX=x+printCellSize-markerSize-1.5*scale;
                markerY=y+printCellSize*marker.position/100-markerSize/2;
              }else if(marker.edge==='top'){
                markerX=x+printCellSize*marker.position/100-markerSize/2;
                markerY=y+1.5*scale;
              }else{
                markerX=x+printCellSize*marker.position/100-markerSize/2;
                markerY=y+printCellSize-markerSize-1.5*scale;
              }
              const parsed=new DOMParser().parseFromString(
                answerArrowSVG(marker.dir,markerSize),
                'image/svg+xml'
              );
              const markerSvg=document.importNode(parsed.documentElement,true);
              markerSvg.setAttribute('x',markerX);
              markerSvg.setAttribute('y',markerY);
              markerSvg.setAttribute('width',markerSize);
              markerSvg.setAttribute('height',markerSize);
              svg.appendChild(markerSvg);
            });
          }

          if(cell.t==='clue'&&Array.isArray(cell.clues)&&cell.clues.length){
            const clues=cell.clues;
            const gap=clues.length>1?0.6:0;
            const usableHeight=printCellSize-gap*(clues.length-1);
            const sizes=clues.map(cl=>cl.textSize&&cl.textSize>0?cl.textSize:textSizePx);
            const weights=clues.map(clueBoxWeight);
            const totalWeight=weights.reduce((sum,weight)=>sum+weight,0)||clues.length;
            let slotY=y;
            clues.forEach((cl,index)=>{
              const slotHeight=usableHeight*(weights[index]/totalWeight);
              if(index>0){
                svg.appendChild(svgNode('line',{
                  x1:x+2,y1:slotY+gap/2,x2:x+printCellSize-2,y2:slotY+gap/2,
                  stroke:'#9966cc','stroke-width':'0.7'
                }));
                slotY+=gap;
              }

              const inset=1;
              const fo=svgNode('foreignObject',{
                x:x+inset,y:slotY+inset,
                width:Math.max(1,printCellSize-inset*2),
                height:Math.max(1,slotHeight-inset*2)
              });
              const slot=document.createElementNS(htmlNS,'div');
              slot.style.cssText='width:100%;height:100%;box-sizing:border-box;display:flex;overflow:hidden;padding:1px 2px;align-items:center;justify-content:center;';

              const text=document.createElementNS(htmlNS,'div');
              const screenLayout=getRenderedClueLayout(o.screenTable,r,c,index);
              text.textContent=screenLayout&&screenLayout.lines.length
                ?screenLayout.lines.join('\n')
                :(cl.clue||'?');
              text.style.cssText='font-family:'+GRID_FONT+';font-weight:600;color:#222;line-height:1.15;text-align:center;overflow:hidden;overflow-wrap:normal;word-break:normal;hyphens:none;min-width:0;min-height:0;width:100%;flex:1 1 auto;';
              if(screenLayout&&screenLayout.lines.length>1)text.style.whiteSpace='pre-line';
              const printTextScale=screenLayout
                ?Math.min(
                    Math.max(1,printCellSize-inset*2-4)/screenLayout.width,
                    Math.max(1,slotHeight-inset*2-2)/screenLayout.height
                  )
                :scale;
              text.style.fontSize=((screenLayout&&screenLayout.fontSize||sizes[index])*printTextScale)+'px';
              slot.appendChild(text);
              fo.appendChild(slot);
              svg.appendChild(fo);
              slotY+=slotHeight;
            });
          }
        }
      }

      // Draw every grid boundary once, above the cell contents. Using SVG strokes
      // avoids browser table-border collapsing or omitted cell borders in print.
      const lineWidth=1.1;
      for(let c=0;c<=C;c++){
        const x=c===0?lineWidth/2:c===C?width-lineWidth/2:c*printCellSize;
        svg.appendChild(svgNode('line',{
          x1:x,y1:0,x2:x,y2:height,stroke:'#222',
          'stroke-width':lineWidth,'shape-rendering':'crispEdges'
        }));
      }
      for(let r=0;r<=R;r++){
        const y=r===0?lineWidth/2:r===R?height-lineWidth/2:r*printCellSize;
        svg.appendChild(svgNode('line',{
          x1:0,y1:y,x2:width,y2:y,stroke:'#222',
          'stroke-width':lineWidth,'shape-rendering':'crispEdges'
        }));
      }
      return svg;
    }

    function addPrintPage(showAnswers){
      const page=document.createElement('section');
      page.className='print-page';
      const heading=document.createElement('h1');
      heading.className='print-title';
      heading.textContent=pageName;
      const gridArea=document.createElement('div');
      gridArea.className='print-grid-area';
      gridArea.appendChild(buildPrintGrid(showAnswers));
      page.append(heading,gridArea);
      pages.appendChild(page);
    }

    if(o.answerPage)addPrintPage(true);
    addPrintPage(false);
    document.body.classList.add('ag-printing');
    window.addEventListener('afterprint',function cleanupPrint(){
      document.body.classList.remove('ag-printing');
      pages.replaceChildren();
      window.removeEventListener('afterprint',cleanupPrint);
    },{once:true});
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        window.print();
      });
    });
  }

  window.ArrowGrid={
    version:'v30',
    GRID_FONT,fontReady,
    arrowSVG,answerArrowSVG,
    getWordCells,firstAnswerTarget,clueBoxWeight,
    getAnswerArrowMarkers,appendAnswerArrowMarkers,
    freshCell,gridFromData,buildCell,
    getRenderedClueLayout,printPuzzle
  };
})();
