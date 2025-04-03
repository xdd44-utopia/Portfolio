using System;
using System.Collections;
using System.Collections.Generic;

using Rhino;
using Rhino.Geometry;

using Grasshopper;
using Grasshopper.Kernel;
using Grasshopper.Kernel.Data;
using Grasshopper.Kernel.Types;

using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Concurrent;


/// <summary>
/// This class will be instantiated on demand by the Script component.
/// </summary>
public abstract class Script_Instance_5210e : GH_ScriptInstance
{
  #region Utility functions
  /// <summary>Print a String to the [Out] Parameter of the Script component.</summary>
  /// <param name="text">String to print.</param>
  private void Print(string text) { /* Implementation hidden. */ }
  /// <summary>Print a formatted String to the [Out] Parameter of the Script component.</summary>
  /// <param name="format">String format.</param>
  /// <param name="args">Formatting parameters.</param>
  private void Print(string format, params object[] args) { /* Implementation hidden. */ }
  /// <summary>Print useful information about an object instance to the [Out] Parameter of the Script component. </summary>
  /// <param name="obj">Object instance to parse.</param>
  private void Reflect(object obj) { /* Implementation hidden. */ }
  /// <summary>Print the signatures of all the overloads of a specific method to the [Out] Parameter of the Script component. </summary>
  /// <param name="obj">Object instance to parse.</param>
  private void Reflect(object obj, string method_name) { /* Implementation hidden. */ }
  #endregion

  #region Members
  /// <summary>Gets the current Rhino document.</summary>
  private readonly RhinoDoc RhinoDocument;
  /// <summary>Gets the Grasshopper document that owns this script.</summary>
  private readonly GH_Document GrasshopperDocument;
  /// <summary>Gets the Grasshopper script component that owns this script.</summary>
  private readonly IGH_Component Component;
  /// <summary>
  /// Gets the current iteration count. The first call to RunScript() is associated with Iteration==0.
  /// Any subsequent call within the same solution will increment the Iteration count.
  /// </summary>
  private readonly int Iteration;
  #endregion
  /// <summary>
  /// This procedure contains the user code. Input parameters are provided as regular arguments,
  /// Output parameters as ref arguments. You don't have to assign output parameters,
  /// they will have a default value.
  /// </summary>
  #region Runscript
  private void RunScript(List<string> ModuleDimensions, List<int> ModuleCounts, double GridSize, DataTree<Point3d> PointGrid, int Seed, bool FreeOrientation, ref object Result, ref object TotalUnfilledCells, ref object TotalLeftoverCount, ref object LeftoverCounts, ref object LeftoverPercentages, ref object SortedTypes, ref object Debug)
  {
    rnd = new Random(Seed);
    moduleDimensions = ModuleDimensions;
    moduleCounts = ModuleCounts;
    gridSize = GridSize;
    pointGrid = PointGrid;
    freeOrientation = FreeOrientation;
    debug = new List<string>();

    initializeArrays();
    convertGrid();
    calculateOptions();
    initializePositionQueue();
    process();

    List<int> leftoverCounts = new List<int>();
    List<double> leftoverPercentages = new List<double>();
    List<string> sortedTypes = new List<string>();
    for (int i = 0; i < options.Count - 1; i++) {
      leftoverCounts.Add(options[i].n);
      double p = Math.Round(100 * (double) options[i].n / (double) options[i].given, 1);
      leftoverPercentages.Add(p);
      sortedTypes.Add(options[i].w + " x " + options[i].h);
    }

    Result = curves;
    TotalUnfilledCells = bigNum - options[options.Count - 1].n;
    TotalLeftoverCount = leftoverCounts.Sum();
    LeftoverCounts = leftoverCounts;
    LeftoverPercentages = leftoverPercentages;
    SortedTypes = sortedTypes;
    Debug = debug;
  }
  #endregion
  #region Additional
  static Random rnd = new Random(5000);

  //Input info
  private List<string> moduleDimensions;
  private List<int> moduleCounts;
  private double gridSize;
  private DataTree<Point3d> pointGrid;
  private bool freeOrientation;

  //Num of surfaces
  private int surfNum;
  //Dimension of wall
  private List<int> width = new List<int>();
  private List<int> height = new List<int>();
  //Dimension in real coordinates
  private List<double> minX = new List<double>();
  private List<double> minY = new List<double>();
  private List<double> maxX = new List<double>();
  private List<double> maxY = new List<double>();
  //Whether a unit has been covered
  private List<List<List<bool>>> map = new List<List<List<bool>>>();
  //Queue storing available positions for process
  private Queue<Position> available = new Queue<Position>();
  //Brick option (width, height, count)
  private List<Option> options = new List<Option>();
  //Final curves
  private DataTree<object> curves = new DataTree<object>();

  public List<string> debug;

  private const int bigNum = 2147483647;

  public class Option {
    public int w;
    public int h;
    public int n;
    public int given;
    public Option(int w, int h) {
      this.w = w;
      this.h = h;
      this.n = 0;
    }
    public Option(int w, int h, int n) {
      this.w = w;
      this.h = h;
      this.n = n;
      this.given = n;
    }
    public void rotate() {
      int t = w;
      w = h;
      h = t;
    }
  }
  public class Position {
    //Denoting sth surface
    public int s;
    public int x;
    public int y;
    public Position(int s, int x, int y) {
      this.s = s;
      this.x = x;
      this.y = y;
    }
  }

  private void initializeArrays() {
    width = new List<int>();
    height = new List<int>();
    minX = new List<double>();
    minY = new List<double>();
    maxX = new List<double>();
    maxY = new List<double>();
    map = new List<List<List<bool>>>();
    available = new Queue<Position>();
    options = new List<Option>();
    curves = new DataTree<object>();
  }

  private void convertGrid() {
    //Convert point grid to rasterized arrays
    surfNum = pointGrid.BranchCount;
    int invalidCount = 0;
    for (int s = 0; s < surfNum; s++){
      List<Point3d> pts = pointGrid.Branches[s];
      if (pts.Count == 0) {
        invalidCount++;
        continue;
      }
      int si = s - invalidCount;
      minX.Add(pts.Min(p => p.X));
      maxX.Add(pts.Max(p => p.X));
      minY.Add(pts.Min(p => p.Y));
      maxY.Add(pts.Max(p => p.Y));
      width.Add((int) Math.Round((maxX[si] - minX[si]) / gridSize) + 1);
      height.Add((int) Math.Round((maxY[si] - minY[si]) / gridSize) + 1);
      map.Add(new List<List<bool>>());
      for (int i = 0; i < width[si]; i++)
      {
        map[si].Add(new List<bool>());
        for (int j = 0; j < height[si]; j++)
        {
          map[si][i].Add(false);
        }
      }
      foreach (Point3d p in pts) {
        map[si][(int) Math.Round((p.X - minX[si]) / gridSize)][(int) Math.Round((p.Y - minY[si]) / gridSize)] = true;
      }
    }
    surfNum -= invalidCount;
  }

  private void calculateOptions() {
    //Calculate brick counts by area if not given
    options = new List<Option>();
    foreach (string optionString in moduleDimensions) {
      string[] optionDim = optionString.Split(' ');
      options.Add(new Option(Int32.Parse(optionDim[0]), Int32.Parse(optionDim[1])));
    }
    if (moduleCounts != null && moduleCounts.Count >= moduleDimensions.Count) {
      for (int i = 0;i < moduleDimensions.Count;i++) {
        options[i].n = moduleCounts[i];
        options[i].given = options[i].n;
      }
    }
    else {
      int totalArea = 0;
      for (int s = 0; s < surfNum; s++) {
        totalArea += width[s] * height[s];
      }
      for (int i = 0; i < options.Count;i++) {
        options[i].n = totalArea / options.Count / (options[i].w * options[i].h);
        options[i].given = options[i].n;
      }
    }
    options.Sort((x, y) => y.w * y.h - x.w * x.h);
    options.Add(new Option(1, 1, bigNum));
  }
  
  private void initializePositionQueue() {
    List <Position> positions = new List<Position>();
    for (int s = 0;s < surfNum;s++) {
      for (int i = 0; i < width[s]; i++) {
        for (int j = 0; j < height[s]; j++) {
          if (map[s][i][j]) {
            positions.Add(new Position(s, i, j));
          }
        }
      }
    }
    //Shuffle the available positions;
    for (int i = 0; i < positions.Count - 2; i++) {
      int j = i + rnd.Next() % (positions.Count - i);
      Position t = positions[j];
      positions[j] = positions[i];
      positions[i] = t;
    }
    for (int i = 0;i < positions.Count;i++) {
      available.Enqueue(positions[i]);
    }
  }

  private void process() {
    for (int currentOption = 0; currentOption < options.Count; currentOption++) {
      int availableCount = available.Count;
      //For each brick option, only need to test each position once
      for (int t = 0; t < availableCount && options[currentOption].n > 0; t++) {
        Position testPosition = available.Dequeue();
        //Dispose the position if it's already covered
        if (map[testPosition.s][testPosition.x][testPosition.y]) {
          if (freeOrientation && rnd.Next() % 2 == 0) {
            options[currentOption].rotate();
          }
          if (fitBrick(testPosition.s, testPosition.x, testPosition.y, options[currentOption].w, options[currentOption].h)) {
            options[currentOption].n--;
          }
          else if (freeOrientation && fitBrick(testPosition.s, testPosition.x, testPosition.y, options[currentOption].h, options[currentOption].w)) {
            options[currentOption].n--;
          }
          else {
            available.Enqueue(testPosition);
          }
        }
      }
    }
  }

  private bool fitBrick(int s, int x, int y, int w, int h)
  {
    //Test if a brick of width w and height h fits if its bottom right corner is placed at position (x, y)
    //Won't fit if the brick is out of boundary
    if (x + w - 1 >= width[s] || y + h - 1 >= height[s]) {
      return false;
    }
    //Won't fit if the available units count is smaller than size of brick
    int test = 0;
    for (int i = x; i < x + w; i++) {
      for (int j = y; j < y + h; j++) {
        test += map[s][i][j] ? 1 : 0;
      }
    }
    if (test < w * h) {
      return false;
    }
    //Update map
    for (int i = x; i <= x + w - 1; i++) {
      for (int j = y; j <= y + h - 1; j++) {
        map[s][i][j] = false;
      }
    }
    curves.Add(Curve.CreateInterpolatedCurve(new List<Point3d>(){
        getCoord(s, x, y),
        getCoord(s, x + w, y),
        getCoord(s, x + w, y + h),
        getCoord(s, x, y + h),
        getCoord(s, x, y)
        }, 1),
      new GH_Path(s)
      );
    return true;
  }

  private Point3d getCoord(int s, int x, int y) {
    return new Point3d(minX[s] + x * gridSize - gridSize / 2, minY[s] + y * gridSize - gridSize / 2, 0);
  }
  #endregion
}