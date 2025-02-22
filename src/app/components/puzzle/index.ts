import { JigsawGenerator } from "./puzzle-generator";
import { registerDraggable, DraggingState } from "./drag-handler";
import {
  formatTime,
  getUrl,
  getImageDimensions,
  clearChildren,
  NS_SVG,
  toPromise,
  interceptEvent,
  transferChildren,
  findStyle,
} from "./utils";
import { downloadDocument } from "./xml-clone";
import { showCertificate, hideCetificate } from "./certificate";
import { registerDropZone } from "./dropzone";

const pathIdMatcher = /^p-(\d+)-(\d+)/;

interface StoredData {
  width: number;
  height: number;
  xCount: number;
  yCount: number;
  time: number;
  startTime?: number;
  endTime?: number;
}

export class MainHandler {
  document: Document;
  root: SVGSVGElement;
  masksElement: SVGGElement;
  imageElement: SVGImageElement;
  uiScaleRule: CSSStyleRule;
  pathGroup: SVGGElement;
  instanceGroup: SVGGElement;
  timeDisp: SVGTextElement;
  dataElement: SVGScriptElement;

  imageUrl?: string;
  width: number = 1;
  height: number = 1;
  baseTime: number = 0;
  theshold: number = 3;
  time: number = 0;
  startTime?: Date;
  endTime?: Date;
  resumeTime?: Date;
  private _xc: number = 2;
  private _yc: number = 2;
  private timer?: number;

  get xCount() {
    return this._xc;
  }
  set xCount(value: number) {
    this._xc = value;
    this._yc = Math.round((value / this.width) * this.height);
    if (this._yc < 2 || !Number.isFinite(this._yc)) {
      this._xc = Math.round((2 / this.height) * this.width);
      this._yc = 2;
    }
  }

  get yCount() {
    return this._yc;
  }
  set yCount(value: number) {
    this._yc = value;
    this._xc = Math.round((value / this.height) * this.width);
    if (this._xc < 2 || !Number.isFinite(this._xc)) {
      this._xc = 2;
      this._yc = Math.round((2 / this.width) * this.height);
    }
  }

  constructor(root: GlobalEventHandlers & ParentNode & Node = document) {
    this.root = root.querySelector("svg")!;
    registerDropZone(this.root);
    this.document = root instanceof Document ? root : this.root.ownerDocument;

    this.masksElement = root.querySelector<SVGGElement>("g#ms")!;
    this.uiScaleRule = findStyle(".ui>*", root);
    this.pathGroup = root.querySelector<SVGGElement>("g#ps")!;
    this.instanceGroup = root.querySelector<SVGGElement>("g#ins")!;
    this.timeDisp = root.querySelector<SVGTextElement>("text#time")!;
    this.dataElement = root.querySelector<SVGScriptElement>("script#data")!;

    // this.root.addEventListener("paste", this.onPaste.bind(this), true);
    // registerDropZone(
    //   this.root.querySelector<SVGElement>("#menu")!,
    //   this.onDragDrop.bind(this)
    // );

    // this.root
    //   .querySelector("#new-game")
    //   ?.addEventListener("click", this.menu.bind(this));
    // this.root
    //   .querySelector("#save-game")
    //   ?.addEventListener("click", this.save.bind(this));

    this.imageElement = root.querySelector<SVGImageElement>("image#img")!;

    window.addEventListener("resize", this.onWindowResize.bind(this));
    Object.assign(
      this,
      registerDraggable(root, this.onDrag.bind(this), this.onDrop.bind(this))
    );
    this.load();
    this.onWindowResize();
    this.init();
  }

  async updateImage(blobOrSrc: string | Blob) {
    const src = blobOrSrc instanceof Blob ? await getUrl(blobOrSrc) : blobOrSrc;
    console.log(src);
    const { width, height } = await getImageDimensions(src);
    this.imageUrl = src;
    this.width = width;
    this.height = height;
    this.xCount = Math.round(width / 100);
  }

  calculateTheshold() {
    this.theshold = Math.max(
      3,
      Math.sqrt((this.width / this._xc) ** 2 + (this.height / this._yc) ** 2) /
        20
    );
  }

  async init() {
    clearChildren(this.pathGroup);
    clearChildren(this.instanceGroup);
    clearChildren(this.masksElement);
    hideCetificate();
    await this.updateImage(location.origin + "/img.jpg");

    this.xCount = 4;
    console.log(this.yCount);
    const unitSize = this._xc * 100;

    this.height *= unitSize / this.width;
    this.width = unitSize;
    this.time = 0;
    this.baseTime = 0;
    this.startTime = new Date();
    this.calculateTheshold();
    delete this.endTime;
    delete this.resumeTime;
    this.timeDisp.textContent = "--:--";
    if (this.timer != null) {
      clearInterval(this.timer);
      delete this.timer;
    }
    const paths = new JigsawGenerator({
      width: this.width,
      height: this.height,
      xCount: this._xc,
      yCount: this._yc,
      radius: Math.min(this.width / this._xc, this.height / this._yc) / 5,
      fixedPattern: false,
    }).toSvgElements(this.document, this.pathGroup);

    // console.log(paths);
    const viewWidth = Math.max(640, this.width * 1.5);
    const viewHeight = Math.max(480, this.height * 1.5);
    this.root.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`);
    this.imageElement.href.baseVal = this.imageUrl!;
    this.imageElement.setAttribute("width", this.width.toString());
    this.imageElement.setAttribute("height", this.height.toString());
    const defs = this.document.createDocumentFragment();
    const instanceGroup = this.document.createDocumentFragment();

    for (const path of paths) {
      const mask = defs.appendChild(
        this.document.createElementNS(NS_SVG, "mask")
      );
      mask.id = `${path.id}-m`;

      const maskPath = mask.appendChild(
        this.document.createElementNS(NS_SVG, "use")
      );

      maskPath.href.baseVal = `#${path.id}`;

      const instance = instanceGroup.appendChild(
        this.document.createElementNS(NS_SVG, "g")
      );

      instance.id = `${path.id}-i`;
      instance.classList.add("draggable");

      const base = instance.appendChild(
        this.document.createElementNS(NS_SVG, "use")
      );

      base.href.baseVal = `#${this.imageElement.id}`;
      base.setAttribute("mask", `url(#${mask.id})`);

      const decoPath = instance.appendChild(
        this.document.createElementNS(NS_SVG, "use")
      );

      decoPath.classList.add("handler", "pzoverlay");
      decoPath.href.baseVal = `#${path.id}`;

      const m = pathIdMatcher.exec(path.id);
      if (m) {
        const w = this.width / this._xc;
        const h = this.height / this._yc;
        instance.transform.baseVal
          .appendItem(this.root.createSVGTransform())
          .setTranslate(
            Math.round(
              Math.random() * (viewWidth - w) - parseInt(m[1], 10) * w
            ),
            Math.round(
              Math.random() * (viewHeight - h) - parseInt(m[2], 10) * h
            )
          );
      }
    }

    this.masksElement.appendChild(defs);
    this.instanceGroup.appendChild(instanceGroup);
    this.serializeToData();
    this.onWindowResize();
  }

  private onDrag(element: SVGElement) {
    element.classList.add("grabbing");
    if (this.timer != null) return;
    this.resumeTime = new Date();
    this.timer = window.setInterval(this.updateTime.bind(this), 1000);
    this.updateTime();
  }

  private onDrop(state: DraggingState) {
    state.element.classList.remove("grabbing");
    const { id } = state.target.parentNode as Element;
    const m = pathIdMatcher.exec(id);
    if (!m) return;
    const x = parseInt(m[1], 10);
    const y = parseInt(m[2], 10);
    state.element = this.checkAndMerge(state.element, `#p-${x + 1}-${y}-i`);
    state.element = this.checkAndMerge(state.element, `#p-${x - 1}-${y}-i`);
    state.element = this.checkAndMerge(state.element, `#p-${x}-${y + 1}-i`);
    state.element = this.checkAndMerge(state.element, `#p-${x}-${y - 1}-i`);
    if (this.instanceGroup.childElementCount > 1) return;
    this.endTime = new Date();
    if (this.timer != null) {
      clearInterval(this.timer);
      delete this.timer;
    }
    const lastElement =
      this.instanceGroup.querySelector<SVGGraphicsElement>(".draggable.group");
    if (lastElement) {
      lastElement.classList.remove("draggable");
      lastElement.transform.baseVal.removeItem(0);
    }
    const viewWidth = Math.max(640, this.width + 20);
    const viewHeight = Math.max(480, this.height + 40);
    this.root.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`);
    this.onWindowResize();
    // showCertificate(this);
  }

  private checkAndMerge(current: SVGGraphicsElement, next: string) {
    const other = this.instanceGroup
      .querySelector(next)
      ?.closest<SVGGraphicsElement>(".draggable");
    if (!other || this.isDragging(other) || other === current) return current;
    const t1 = current.transform.baseVal;
    if (!t1.numberOfItems) return current;
    const t2 = other.transform.baseVal;
    if (!t2.numberOfItems) return current;
    const m1 = t1.getItem(0).matrix;
    const m2 = t2.getItem(0).matrix;
    if (Math.sqrt((m1.e - m2.e) ** 2 + (m1.f - m2.f) ** 2) > this.theshold)
      return current;
    const currentIsGroup = current.classList.contains("group");
    const otherIsGroup = other.classList.contains("group");
    if (currentIsGroup) {
      if (!otherIsGroup) {
        other.classList.remove("draggable");
        t2.removeItem(0);
        current.appendChild(other);
      } else if (other.childElementCount > current.childElementCount) {
        transferChildren(current, other);
        current.remove();
        return other;
      } else {
        transferChildren(other, current);
        other.remove();
      }
      return current;
    }
    if (otherIsGroup) {
      current.classList.remove("draggable");
      t1.removeItem(0);
      other.appendChild(current);
      return other;
    }
    const newGroup = current.parentNode!.appendChild(
      this.document.createElementNS(NS_SVG, "g")
    );
    newGroup.classList.add("draggable", "group");
    newGroup.appendChild(current);
    current.classList.remove("draggable");
    newGroup.appendChild(other);
    other.classList.remove("draggable");
    const t = t2.getItem(0);
    t1.removeItem(0);
    t2.removeItem(0);
    newGroup.transform.baseVal.appendItem(t);
    return newGroup;
  }

  private isDragging(element: SVGElement) {
    return false;
  }

  private updateTime() {
    this.time = Date.now() - this.resumeTime!.getTime() + this.baseTime;
    this.timeDisp.textContent = formatTime(this.time);
  }

  // private menu() {
  //   this.menuGroup.classList.add("show");
  // }

  private load() {
    const data: StoredData | null = JSON.parse(
      this.dataElement.textContent || "null"
    );
    if (data == null) return;
    this.width = data.width || 1;
    this.height = data.height || 1;
    this.baseTime = data.time || 0;
    this._xc = data.xCount || 1;
    this._yc = data.yCount || 1;
    if (data.startTime != null) this.startTime = new Date(data.startTime);
    if (data.endTime != null) this.endTime = new Date(data.endTime);
    this.calculateTheshold();
  }

  private serializeToData() {
    if (this.resumeTime != null && this.endTime == null) this.updateTime();
    this.dataElement.textContent = JSON.stringify({
      width: this.width,
      height: this.height,
      xCount: this._xc,
      yCount: this._yc,
      startTime: this.startTime?.getTime(),
      endTime: this.endTime?.getTime(),
      time: this.time,
    } as StoredData);
  }

  private save() {
    this.serializeToData();
    return downloadDocument(this.root, `puzzle-${Date.now()}.svg`, beforeSave);
  }

  private onWindowResize() {
    let viewWidth: number, viewHeight: number;
    if (!this.dataElement.textContent) {
      if (window.innerWidth > window.innerHeight) {
        viewHeight = 480;
        viewWidth = (viewHeight / window.innerHeight) * window.innerWidth;
      } else {
        viewWidth = 640;
        viewHeight = (viewWidth / window.innerWidth) * window.innerHeight;
      }
      this.root.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`);
    } else {
      const viewBox = this.root.viewBox.baseVal;
      viewWidth = viewBox.width;
      viewHeight = viewBox.height;
    }
    const viewRatio = viewWidth / viewHeight;
    const windowRatio = window.innerWidth / window.innerHeight;
    const scale =
      (viewRatio > windowRatio
        ? viewWidth / window.innerWidth
        : viewHeight / window.innerHeight) * window.devicePixelRatio;
    this.uiScaleRule.style.transform = `scale(${scale})`;
  }

  // private onPaste(e: ClipboardEvent) {
  //   if (
  //     this.menuGroup.classList.contains("show") &&
  //     e.clipboardData &&
  //     e.clipboardData.files.length
  //   ) {
  //     interceptEvent(e);
  //     this.onDragDrop(e.clipboardData);
  //   }
  // }

  private async onDragDrop(dataTransfer: DataTransfer) {
    let loaded = false;

    for (const item of dataTransfer.items) {
      switch (item.kind) {
        case "file": {
          if (!item.type.startsWith("image/")) break;
          const file = item.getAsFile();
          if (!file) break;
          try {
            this.updateImage(file);
            loaded = true;
          } catch {}
          break;
        }
        case "string":
          switch (item.type) {
            case "text/uri-list":
              for (const row of (await toPromise(item, item.getAsString)).split(
                "\r\n"
              ))
                try {
                  await this.updateImage(await (await fetch(row)).blob());
                  loaded = true;
                  break;
                } catch {}
              break;
          }
          break;
      }
      if (loaded) break;
    }
    return loaded;
  }
}

//new MainHandler();

function beforeSave(root: Element) {
  root.classList.add("noscript");
  root
    .querySelector<SVGGElement>("g#ui")
    ?.transform.baseVal.getItem(0)
    ?.setScale(1, 1);
}
