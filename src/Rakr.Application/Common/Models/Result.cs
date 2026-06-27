namespace Rakr.Application.Common.Models;

public class Result
{
    public bool Succeeded { get; }
    public string[] Errors { get; }

    protected Result(bool succeeded, IEnumerable<string> errors)
    {
        Succeeded = succeeded;
        Errors = errors.ToArray();
    }

    public static Result Success() => new(true, []);
    public static Result Failure(params string[] errors) => new(false, errors);
}

public class Result<T> : Result
{
    public T? Data { get; }

    private Result(bool succeeded, T? data, IEnumerable<string> errors)
        : base(succeeded, errors)
    {
        Data = data;
    }

    public static Result<T> Success(T data) => new(true, data, []);
    public new static Result<T> Failure(params string[] errors) => new(false, default, errors);
}
