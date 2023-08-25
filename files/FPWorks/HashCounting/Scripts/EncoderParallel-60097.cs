using System;
using System.Collections;
using System.Collections.Generic;

using Rhino;
using Rhino.Geometry;

using Grasshopper;
using Grasshopper.Kernel;
using Grasshopper.Kernel.Data;
using Grasshopper.Kernel.Types;

using System.Collections.Concurrent;
using System.Threading.Tasks;
using System.Linq;


/// <summary>
/// This class will be instantiated on demand by the Script component.
/// </summary>
public abstract class Script_Instance_60097 : GH_ScriptInstance
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
  private void RunScript(DataTree<Point3d> Points, DataTree<Point3d> Centroids, bool EnableSHA, ref object ShapeIdentifiers, ref object MirrorIdentifiers)
  {

    int total = Points.BranchCount;

    ConcurrentDictionary<int, List<double>> concurrentShapeIdentifiers = new ConcurrentDictionary<int, List<double>>();
    ConcurrentDictionary<int, List<double>> concurrentMirrorIdentifiers = new ConcurrentDictionary<int, List<double>>();

    Parallel.For(0, total, i => {

      List<Point3d> points = Points.Branches[i];
      points = points.OrderBy(p => getPointSortKey(p, points)).ToList();

      //All points' distances to each other
      List<double> shapeIdentifiers = new List<double>();
      for (int j = 0;j < points.Count - 1;j++) {
        for (int k = i + 1;k < points.Count;k++) {
          shapeIdentifiers.Add(points[j].DistanceTo(points[k]));
        }
      }
      shapeIdentifiers.Sort();
      concurrentShapeIdentifiers[i] = shapeIdentifiers;

      //If consists of multiple pieces
      List<double> mirrorIdentifiers = new List<double>();
      if (Centroids.Branches[i].Count > 1) {
        List<Point3d> controids = Centroids.Branches[i];
        controids.OrderBy(p => getPointSortKey(p, points));
        Vector3d v1 = controids.Last() - points.First();
        Vector3d v2 = controids.First() - points.First();
        Vector3d cp = Vector3d.CrossProduct(v1, v2);
        Point3d rp = points.First() + cp;
        mirrorIdentifiers.AddRange(points.Select(p => p.DistanceTo(rp)));
        if (Math.Abs(getPointSortKey(controids.First(), points) - getPointSortKey(controids.Last(), points)) < eps) {
          cp = Vector3d.CrossProduct(v2, v1);
          rp = points.First() + cp;
          mirrorIdentifiers.AddRange(points.Select(p => p.DistanceTo(rp)));
        }
        mirrorIdentifiers.Sort();
        concurrentMirrorIdentifiers[i] = mirrorIdentifiers;
      }
      else {
        concurrentMirrorIdentifiers[i] = new List<double>(0);
      }

    });

    DataTree<object> AllShapeIdentifier = new DataTree<object>();
    DataTree<object> AllMirrorIdentifier = new DataTree<object>();
    for (int i=0;i<total;i++) {
      AllShapeIdentifier.Add(concurrentShapeIdentifiers[i], new GH_Path(i));
      AllMirrorIdentifier.Add(concurrentMirrorIdentifiers[i], new GH_Path(i));
    }
    ShapeIdentifiers = AllShapeIdentifier;
    MirrorIdentifiers = AllMirrorIdentifier;

  }
  #endregion
  #region Additional
  private const double eps = 0.00001;

  private double getPointSortKey(Point3d tar, List<Point3d> refs) {
    return refs.Sum(p => tar.DistanceTo(p));
  }
  #endregion
}