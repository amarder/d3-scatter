function _extract(key, l) {
    return l.map(function(e) {
        return e[key];
    });
}

function Scatter(selector, xvar, yvar, xlabel, ylabel) {
    this.selector = selector;
    this.container = d3.select(this.selector);
    this.xvar = xvar;
    this.yvar = yvar;
    this.xlabel = xlabel;
    this.ylabel = ylabel;
    this.dims = {};

    // methods used for callbacks
    var that = this;
    this._transform = function(d) {
        return "translate(" + that.x(d[that.xvar]) + "," + that.y(d[that.yvar]) + ")";
    };
    this._resize = function() {
        var dims = that._set_dims();
        
        d3.select('#scatter > svg')
            .attr("width", dims.outerWidth)
            .attr("height", dims.outerHeight);
    
        d3.select('.x')
            .attr("transform", "translate(0," + dims.height + ")");
    
        d3.select('.x > .label')
            .attr("x", dims.width);
        
        d3.select('.objects')
            .attr("width", dims.width)
            .attr("height", dims.height);
    
        // refresh the axes
        d3.select("g.y.axis")
            .call(that.yAxis);
        d3.select("g.x.axis")
            .call(that.xAxis);
    
        // refresh the points
        d3.select('svg.objects')
            .selectAll(".dot")
            .attr("transform", that._transform);
    
        // refresh the zoom
        that._init_zoom();
        that._update_tooltip();
    };
}

Scatter.prototype._set_dims = function() {
    var margin = {top: 15, right: 35, bottom: 35, left: 35};
    this.margin = margin;

    var outerWidth = parseInt(this.container.style('width'));
    var outerHeight = Math.min(outerWidth * (3/4), window.innerHeight * 0.9);
    if (window.innerHeight <= 350 / 0.9) {
        outerHeight = 350;
    }
    var width = outerWidth - margin.left - margin.right;
    var height = outerHeight - margin.top - margin.bottom;

    this.dims.outerWidth = outerWidth;
    this.dims.outerHeight = outerHeight;
    this.dims.width = width;
    this.dims.height = height;

    this.x = d3.scale.linear().nice().range([0, width]).domain(this.xdomain);
    this.y = d3.scale.linear().nice().range([height, 0]).domain(this.ydomain);
    this.xAxis = d3.svg.axis().orient("bottom").ticks(5).scale(this.x);
    this.yAxis = d3.svg.axis().orient("left").ticks(5).scale(this.y);

    return this.dims;
};

Scatter.prototype._setup = function() {
    var dims = this._set_dims();
    var margin = this.margin;

    var svg = this.container
      .append("svg")
        .attr("width", dims.outerWidth)
        .attr("height", dims.outerHeight)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    this.svg = svg;

    // labels for the axes
    svg.append("g")
        .classed("x axis", true)
        .attr("transform", "translate(0," + dims.height + ")")
        .call(this.xAxis)
      .append("text")
        .classed("label", true)
        .attr("x", dims.width)
        .attr("y", -10)
        .style("text-anchor", "end")
        .text(this.xlabel);
    
    svg.append("g")
        .classed("y axis", true)
        .call(this.yAxis)
      .append("text")
        .classed("label", true)
        .attr("transform", "rotate(-90)")
        .attr("y", 10)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text(this.ylabel);
    
    var objects = svg.append("svg")
        .classed("objects", true)
        .attr("width", dims.width)
        .attr("height", dims.height);

    var that = this;
    d3.select(window).on('resize', that._resize);
    this._init_tooltip();
    this._init_zoom();
};
        
Scatter.prototype.populate = function(url) {
    // data cleaning function specific to this data
    function _clean(d) {
        d.pages = +d.pages;
        d.sales_rank = +d.sales_rank;
        d.log_sales_rank = Math.log10(d.sales_rank);
    }

    var that = this;
    d3.json(url, function(data) {
        data.forEach(_clean);
    
        // set up x and y domains
        var xMax = d3.max(_extract(that.xvar, data));
            xMin = d3.min(_extract(that.xvar, data));
            yMax = d3.max(_extract(that.yvar, data));
            yMin = d3.min(_extract(that.yvar, data));
        var border = 0.125;
        var xpad = border * (xMax - xMin),
            ypad = border * (yMax - yMin);
    
        that.xdomain = [xMin - xpad, xMax + xpad];
        that.ydomain = [yMin - ypad, yMax + ypad];
        d3.selectAll(that.selector + ' *').remove();
        that._setup();
    
        // set up points
        d3.select('svg.objects')
            .selectAll(".dot")
            .data(data)
            .enter()
            .append("circle")
            .classed("dot", true)
            .attr("asin", function(d) {return d.ASIN;})
            .attr("r", 5)
            .attr("transform", that._transform);
    
        that._link_tooltip();
    });
};

Scatter.prototype._init_tooltip = function() {
    this.tip = d3.tip()
        .attr("class", "d3-tip")
        .offset([-10, 0])
        .html(function(d) {
            var link = '<a href="' + d.url + '" target="_">' + d.title + '</a>';
            var table = [
                ['Title', link],
                ['Author', d.authors.join(', ')],
                ['Sales Rank', d.sales_rank],
                ['Pages', d.pages]
            ];
            rows = table.map(function(x) {
                return '<tr><td>' + x.join('</td><td>') + '</td></tr>';
            });
            var open_tag = '<table class="tooltip" asin="' + d.ASIN + '">'
            return open_tag + rows.join('') + '</table>';
        });
    d3.select(this.selector + ' > svg').call(this.tip);
};

Scatter.prototype._tip_is_visible = function() {
    var x = $('div.d3-tip')[0];
    return x.style['opacity'] != 0;
};

Scatter.prototype._link_tooltip = function() {
    var that = this;

    this.container
        .selectAll(".dot")
        .on("click", function(d) {
            if (that._tip_is_visible()) {
                that.tip.hide(d);
            }
            else {
                that.tip.show(d, this);
            }
        });
};

Scatter.prototype._update_tooltip = function() {
    var e = d3.select('.d3-tip a')[0][0];
    if (e) {
        // get the ASIN from the current tooltip
        var l = e.href.split('/');
        var args = l[l.length - 1];
        var asin = args.split('%')[0];

        // find the corresponding point
        var point = 'circle[asin="' + asin + '"]';

        // refresh the tooltip's location
        if (this._tip_is_visible()) {
            this.tip.show(
                d3.select(point).data()[0], d3.select(point)[0][0]
            );
        }
    }
};

Scatter.prototype._init_zoom = function() {
    var that = this;
    
    function zoomed() {
        svg.select(".x.axis").call(that.xAxis);
        svg.select(".y.axis").call(that.yAxis);

        svg.selectAll(".dot")
            .attr("transform", that._transform);

        that._update_tooltip()
    }

    var zoom = d3.behavior.zoom()
        .x(this.x)
        .y(this.y)
        .scaleExtent([0.5, 32])
        .on("zoom", zoomed);
    
    var svg = d3.select(this.selector + ' > svg');
    svg.call(zoom);
};

var s = new Scatter(
    selector='#scatter',
    xvar="pages",
    yvar="log_sales_rank",
    xlabel="Pages",
    ylabel="Sales Rank, log₁₀"
);
s.populate("/books/npr-2015.json");
