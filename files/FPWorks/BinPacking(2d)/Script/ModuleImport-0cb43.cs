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


/// <summary>
/// This class will be instantiated on demand by the Script component.
/// </summary>
public abstract class Script_Instance_0cb43 : GH_ScriptInstance
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
  private void RunScript(List<Curve> Curves, int Precision, bool FreeOrientation, ref object ModuleDimensions, ref object ModuleCounts, ref object UnitLength)
  {

    debug = new List<string>();

    List<Dimension> dimensions = Curves.Select(c => new Dimension(
      (int)(Math.Round(c.GetBoundingBox(true).Max.X - c.GetBoundingBox(true).Min.X, Precision) * Math.Pow(10, Precision)),
      (int)(Math.Round(c.GetBoundingBox(true).Max.Y - c.GetBoundingBox(true).Min.Y, Precision) * Math.Pow(10, Precision)),
      FreeOrientation
    )).ToList();

    HashSet<int> lengths = new HashSet<int>();
    lengths.UnionWith(dimensions.Select(d => d.w));
    lengths.UnionWith(dimensions.Select(d => d.h));
    int gridSize = getGCD(lengths.ToList());
    
    foreach (Dimension dimension in dimensions) {
      dimension.w /= gridSize;
      dimension.h /= gridSize;
    }

    HashSet<Dimension> dimensionSet = new HashSet<Dimension>();
    dimensionSet.UnionWith(dimensions);
    List<Dimension> dimensionOptions = dimensionSet.ToList();
    dimensionOptions.Sort((x, y) => (x.w * x.h - y.w * y.h));

    List<string> moduleDimensions = dimensionOptions.Select(d => d.w + " " + d.h).ToList();

    List<int> moduleCounts = new List<int>();
    for (int i = 0; i < dimensionOptions.Count; i++) {
      moduleCounts.Add(0);
      foreach(Dimension dimension in dimensions) {
        if (dimension.Equals(dimensionOptions[i])) {
          moduleCounts[i]++;
        }
      }
    }

    ModuleDimensions = moduleDimensions;
    ModuleCounts = moduleCounts;
    UnitLength = gridSize / Math.Pow(10, Precision);

  }
  #endregion
  #region Additional

  private List<string> debug;

  private class Dimension {
    public int w;
    public int h;
    public Dimension(int w, int h, bool freeOrientation) {
      if (freeOrientation) {
        this.w = (w < h ? w : h);
        this.h = (w > h ? w : h);
      }
      else {
        this.w = w;
        this.h = h;
      }
    }
    public override string ToString() {
      return w + " " + h;
    }
    public override bool Equals(object obj) {
      return this.Equals(obj as Dimension);
    }
    public bool Equals(Dimension other) {
      return (Math.Abs(w - other.w) == 0 && Math.Abs(h - other.h) == 0);
    }
    public override int GetHashCode() {
      return 0;
    }
  }

  private int GCD(int a, int b) {
    if (a < b) {
      int t = b;
      b = a;
      a = t;
    }
    if (b == 0) {
      return a;
    }
    else {
      return GCD(b, a % b);
    }
  }

  private int getGCD(List<int> list) {
    int result = list.First();
    for (int i=1;i<list.Count;i++) {
      result = GCD(result, list[i]);
    }
    return result;
  }
  #endregion
}