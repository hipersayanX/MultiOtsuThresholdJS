function readImage(elementId)
{
    var img = document.getElementById(elementId);

    var canvas = document.createElement("canvas");
    canvas.width  = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    return {width: img.width, height: img.height, data: data};
}

function histogram(image)
{
    // Create the histogram
    var histogram = new Array(256);
    histogram.fill(0);

    for (var i = 0; i < image.data.length; i += 4) {
        var luma = (  11 * image.data[i]
                    + 16 * image.data[i + 1]
                    +  5 * image.data[i + 2]) >> 5;
        histogram[luma]++;
    }

    // Since we use sum tables add one more to avoid unexistent colors.
    for (var i = 0; i < histogram.length; i++)
        histogram[i]++;

    return histogram;
}

function buildTables(histogram)
{
    // Create cumulative sum tables.
    var P = new Array(histogram.length + 1);
    var S = new Array(histogram.length + 1);
    P[0] = 0;
    S[0] = 0;

    var sumP = 0;
    var sumS = 0;

    for (var i = 0; i < histogram.length; i++) {
        sumP += histogram[i];
        sumS += i * histogram[i];
        P[i + 1] = sumP;
        S[i + 1] = sumS;
    }

    // Calculate the between-class variance for the interval u-v
    var H = new Array(histogram.length * histogram.length);
    H.fill(0.);

    for (var u = 0; u < histogram.length; u++)
        for (var v = u + 1; v < histogram.length; v++)
            H[v + u * histogram.length] = Math.pow(S[v] - S[u], 2) / (P[v] - P[u]);

    return H;
}

var maxSum = 0.;
var thresholds = [];

function for_loop(H, u, vmax, level, levels, index)
{
    var classes = index.length - 1;

    for (var i = u; i < vmax; i++) {
        index[level] = i;

        if (level + 1 >= classes) {
            // Reached the end of the for loop.

            // Calculate the quadratic sum of al intervals.
            var sum = 0.;

            for (var c = 0; c < classes; c++) {
                var u = index[c];
                var v = index[c + 1];
                var s = H[v + u * levels];
                sum += s;
            }

            if (maxSum < sum) {
                // Return calculated threshold.
                thresholds = index.slice(1, index.length - 1);
                maxSum = sum;
            }
        } else
            // Start a new for loop level, one position after current one.
            for_loop(H,
                    i + 1,
                    vmax + 1,
                    level + 1,
                    levels,
                    index);
    }
}

function otsu(histogram, classes)
{
    maxSum = 0.;
    thresholds = new Array(classes - 1);
    thresholds.fill(0);
    var H = buildTables(histogram);
    var index = new Array(classes + 1);
    index[0] = 0;
    index[index.length - 1] = histogram.length - 1;

    for_loop(H,
            1,
            histogram.length - classes + 1,
            1,
            histogram.length,
            index);

    return thresholds;
}

function drawResult(thresholds, classes)
{
    var src = document.getElementById("otsu-test-src");

    var dst = document.getElementById("otsu-test-dst");
    dst.width = src.width;
    dst.height = src.height;
    var ctx = dst.getContext("2d");
    ctx.drawImage(src, 0, 0, dst.width, dst.height);
    var imageData = ctx.getImageData(0, 0, dst.width, dst.height)
    var dstData = imageData.data;

    var colors = new Array(classes);

    for (var i = 0; i < classes; i++)
        colors[i] = Math.round(255 * i / (classes - 1));

    var colorTable = new Array(256);
    var j = 0;

    for (var i = 0; i < colorTable.length; i++) {
        if (j < thresholds.length && i >= thresholds[j])
            j++;

        colorTable[i] = colors[j];
    }

    for (var i = 0; i < dstData.length; i += 4) {
        var luma = (  11 * dstData[i]
                    + 16 * dstData[i + 1]
                    +  5 * dstData[i + 2]) >> 5;
        luma = colorTable[luma];

        dstData[i]     = luma;
        dstData[i + 1] = luma;
        dstData[i + 2] = luma;
        dstData[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);//, 0, 0, dst.width, dst.height);
}

function drawGraph(histogram, thresholds)
{
    var maxVal = Math.max.apply(null, histogram);

    var board = JXG.JSXGraph.initBoard("otsu-histogram",
                                    {axis: true,
                                        boundingbox: [-1, maxVal * 1.1, 264, -maxVal * 0.1]});

    var x = [];

    for (var i = 0; i < histogram.length; i++)
        x[i] = i;

    board.create('curve', [x, histogram], {strokeColor: "red"});
    var lines = []

    for (var i = 0; i < thresholds.length; i++) {
        var th = thresholds[i];
        var thPoint = board.create('point', [th, maxVal * 0.75], {name: th, color: "blue"});
        var thLine = board.create('line', [thPoint, [th, 0]], {color: "blue"});
        lines.push(thLine);
    }

    board.on('move', function() {
        for (var i = 0; i < thresholds.length; i++) {
            var th = thresholds[i];
            lines[i].point1.moveTo([th, maxVal * 0.75]);
            lines[i].point2.moveTo([th, maxVal * 0]);
        }
    });
}

function update()
{
    var img = readImage("otsu-test-src");
    var hist = histogram(img);

    var classes = document.getElementById("n-classes");
    var nclasses = parseInt(classes.value);

    var thresholds = otsu(hist, nclasses);

    var thresholdsResults = document.getElementById("thresholds-results");
    thresholdsResults.value = thresholds.toString();
    drawResult(thresholds, nclasses);
    drawGraph(hist, thresholds);
}

function loadImage(element)
{
    var reader = new FileReader();

    reader.onload = function (e) {
        var img = document.getElementById("otsu-test-src");
        img.src = e.target.result;
    }

    reader.readAsDataURL(element.files[0]);
}

function onNClassesChanged(element)
{
        update();
}
