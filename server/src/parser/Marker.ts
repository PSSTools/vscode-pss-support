
export class Marker {
    lineno : number;
    linepos : number;
    length : number
    msg : string;

    constructor(line, pos, len, msg) {
        this.lineno = line;
        this.linepos = pos;
        this.length = len;
        this.msg = msg;
    }
    

}